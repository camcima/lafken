import type { LafkenClient } from "@lafken/client";
import React, { useCallback, useContext, useEffect, useRef, useState } from "react";

import { _evictPresetUrl, _getCachedPresetUrl, _resetPresetUrlCache, cacheUpdateBus } from "./_url-cache";
import { _LafkenClientContext } from "./lafken-provider";

/**
 * Test-only — re-exported for back-compat. <AssetImage> and useAssetPresetUrl
 * share the cache in `_url-cache.ts`, so resetting it covers both.
 */
export function _resetAssetImageCache(): void {
  _resetPresetUrlCache();
}

interface IFetchState {
  key: string;
  url: string | null;
  errored: boolean;
  /** Whether we've already retried once after an img load error. */
  retried: boolean;
}

export interface IAssetImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
  publicId: string;
  preset: string;
  /** Override the context client. */
  client?: LafkenClient;
}

export function AssetImage(props: IAssetImageProps): React.JSX.Element | null {
  const {
    publicId,
    preset,
    client: clientOverride,
    alt,
    loading,
    decoding,
    onError,
    ...rest
  } = props;
  const ctxClient = useContext(_LafkenClientContext);
  const client: LafkenClient | null = clientOverride ?? ctxClient;
  if (client === null) {
    throw new Error("<AssetImage> requires either a `client` prop or a <LafkenProvider> ancestor");
  }

  const key: string = `${publicId}|${preset}`;
  const [state, setState] = useState<IFetchState>({
    key,
    url: null,
    errored: false,
    retried: false,
  });
  // When the key changes we render a stale state for one frame; derive the
  // visible state from the current key so we never render the previous URL
  // for the new (publicId, preset) pair.
  const visibleState: IFetchState =
    state.key === key ? state : { key, url: null, errored: false, retried: false };

  // clientRef lets the cache-update effect read the latest client without
  // being in its dependency array (the effect should only run once per key).
  const clientRef = useRef<LafkenClient>(client);
  clientRef.current = client;

  useEffect(() => {
    let cancelled = false;
    const promise: Promise<string> = _getCachedPresetUrl(client, publicId, preset);
    promise.then(
      (resolved: string) => {
        if (!cancelled) setState({ key, url: resolved, errored: false, retried: false });
      },
      () => {
        if (!cancelled) setState({ key, url: null, errored: true, retried: false });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [client, publicId, preset, key]);

  // Subscribe to background-refresh completions and update the displayed URL.
  useEffect(() => {
    function onCacheUpdated(ev: Event): void {
      const eventKey = (ev as CustomEvent<{ key: string }>).detail.key;
      if (eventKey !== key) return;
      // Re-read from the cache (synchronous resolve for a fresh entry)
      void _getCachedPresetUrl(clientRef.current, publicId, preset).then((resolved: string) => {
        setState((prev) => {
          if (prev.key !== key) return prev;
          return { ...prev, url: resolved, errored: false };
        });
      });
    }
    cacheUpdateBus.addEventListener("cache-updated", onCacheUpdated);
    return () => {
      cacheUpdateBus.removeEventListener("cache-updated", onCacheUpdated);
    };
  }, [key, publicId, preset]);

  const handleError = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
      if (onError !== undefined) onError(event);

      setState((prev) => {
        if (prev.key !== key) return prev;
        if (prev.retried) {
          // Already retried once — give up and render nothing
          return { ...prev, url: null, errored: true };
        }
        // First error: evict cache entry and trigger a retry fetch
        _evictPresetUrl(publicId, preset);
        // Re-fetch (marks retried=true to prevent infinite loop)
        void _getCachedPresetUrl(clientRef.current, publicId, preset).then(
          (resolved: string) => {
            setState((s) => {
              if (s.key !== key) return s;
              return { ...s, url: resolved, errored: false, retried: true };
            });
          },
          () => {
            setState((s) => {
              if (s.key !== key) return s;
              return { ...s, url: null, errored: true, retried: true };
            });
          },
        );
        // Temporarily hide the image while the retry is in flight
        return { ...prev, url: null, errored: false, retried: true };
      });
    },
    [key, publicId, preset, onError],
  );

  if (visibleState.errored || visibleState.url === null) return null;

  return (
    <img
      {...rest}
      src={visibleState.url}
      alt={alt ?? ""}
      loading={loading ?? "lazy"}
      decoding={decoding ?? "async"}
      onError={handleError}
    />
  );
}
