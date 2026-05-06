import type { LafkenClient } from "@lafken/client";
import React, { useContext, useEffect, useState } from "react";

import { _getCachedPresetUrl, _resetPresetUrlCache } from "./_url-cache";
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
  const [state, setState] = useState<IFetchState>({ key, url: null, errored: false });
  // When the key changes we render a stale state for one frame; derive the
  // visible state from the current key so we never render the previous URL
  // for the new (publicId, preset) pair.
  const visibleState: IFetchState = state.key === key ? state : { key, url: null, errored: false };

  useEffect(() => {
    let cancelled = false;
    const promise: Promise<string> = _getCachedPresetUrl(client, publicId, preset);
    promise.then(
      (resolved: string) => {
        if (!cancelled) setState({ key, url: resolved, errored: false });
      },
      () => {
        if (!cancelled) setState({ key, url: null, errored: true });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [client, publicId, preset, key]);

  if (visibleState.errored || visibleState.url === null) return null;

  return (
    <img
      {...rest}
      src={visibleState.url}
      alt={alt ?? ""}
      loading={loading ?? "lazy"}
      decoding={decoding ?? "async"}
      onError={(event) => {
        setState({ key, url: null, errored: true });
        if (onError !== undefined) onError(event);
      }}
    />
  );
}
