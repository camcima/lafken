import React, { useState } from "react";

export interface IAssetImageAsset {
  /** Map of preset name → fully-signed preview URL the browser can fetch directly. */
  previewUrls?: Record<string, string> | undefined;
}

export interface IAssetImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
  /** Asset-shaped value with a `previewUrls` map. `null` / `undefined` renders nothing. */
  asset: IAssetImageAsset | null | undefined;
  /**
   * Preset name to look up in `asset.previewUrls`. When omitted (or the named
   * preset is missing), the first available preview URL is used.
   */
  preset?: string;
}

export function AssetImage(props: IAssetImageProps): React.JSX.Element | null {
  const { asset, preset, onError, loading, decoding, alt, ...rest } = props;
  const [errored, setErrored] = useState(false);
  const url = pickUrl(asset?.previewUrls, preset);
  if (url === undefined || errored) return null;
  return (
    <img
      {...rest}
      src={url}
      alt={alt ?? ""}
      loading={loading ?? "lazy"}
      decoding={decoding ?? "async"}
      onError={(event) => {
        setErrored(true);
        if (onError !== undefined) onError(event);
      }}
    />
  );
}

function pickUrl(
  previewUrls: Record<string, string> | undefined,
  preset: string | undefined,
): string | undefined {
  if (previewUrls === undefined) return undefined;
  if (preset !== undefined) {
    const named = previewUrls[preset];
    if (named !== undefined) return named;
  }
  const keys: string[] = Object.keys(previewUrls);
  if (keys.length === 0) return undefined;
  return previewUrls[keys[0]];
}
