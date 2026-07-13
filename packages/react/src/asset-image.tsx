import type { LafkenClient } from "@lafken/client";
import React, { useCallback, useContext, useEffect, useRef, useState } from "react";

import {
  _evictPresetUrl,
  _getCachedPresetUrl,
  _resetPresetUrlCache,
  cacheUpdateBus,
  type ICacheUpdatedDetail,
} from "./_url-cache";
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

  // clientRef lets the img-error retry (below) reach the latest client without
  // putting `client` in the useCallback deps, which would rebuild the handler —
  // and re-attach the img's onError — on every render that passes a new client.
  const clientRef = useRef<LafkenClient>(client);
  useEffect(() => {
    clientRef.current = client;
  }, [client]);

  useEffect(() => {
    let cancelled = false;
    const promise: Promise<string> = _getCachedPresetUrl(client, publicId, preset);
    promise.then(
      (resolved: string) => {
        if (cancelled) return;
        // This read can resolve with a stale-but-valid URL *after* a refresh it
        // itself triggered has already been delivered over the bus. Any URL
        // already present for this key came from a later cache write, so never
        // move backwards.
        setState((prev) =>
          prev.key === key && prev.url !== null
            ? prev
            : { key, url: resolved, errored: false, retried: false },
        );
      },
      () => {
        if (!cancelled) setState({ key, url: null, errored: true, retried: false });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [client, publicId, preset, key]);

  // Subscribe to refresh completions and swap the displayed URL.
  //
  // The event carries the resolved URL, so this listener never reads the cache
  // back. Re-entering _getCachedPresetUrl() here would close a feedback loop
  // (fetch -> dispatch -> re-read -> fetch -> ...) that never terminates for an
  // unparseable expiresAt or a sub-minute TTL. It also keeps the listener free
  // of promises, so there is no rejection to leak.
  //
  // `key` is the only dependency: publicId/preset are its components, and no
  // client is needed now that we don't call into the cache.
  useEffect(() => {
    function onCacheUpdated(ev: Event): void {
      const detail: ICacheUpdatedDetail = (ev as CustomEvent<ICacheUpdatedDetail>).detail;
      if (detail.key !== key) return;
      setState((prev) => {
        if (prev.key !== key) return prev;
        return { ...prev, url: detail.url, errored: false };
      });
    }
    cacheUpdateBus.addEventListener("cache-updated", onCacheUpdated);
    return () => {
      cacheUpdateBus.removeEventListener("cache-updated", onCacheUpdated);
    };
  }, [key]);

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
