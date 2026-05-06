import type { LafkenClient } from "@lafken/client";
import { useContext, useEffect, useState } from "react";

import { _getCachedPresetUrl } from "./_url-cache";
import { _LafkenClientContext } from "./lafken-provider";

export interface IUseAssetPresetUrlResult {
  url: string | null;
  isLoading: boolean;
  error: Error | null;
}

export interface IUseAssetPresetUrlOptions {
  /** Override the context client. */
  client?: LafkenClient;
}

interface IFetchState {
  key: string;
  url: string | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Resolves a per-asset, per-preset preview URL through the LafkenClient.
 *
 * Shares the module-level dedup cache with <AssetImage>, so multiple
 * subscribers to the same (publicId, preset) trigger exactly one fetch.
 */
export function useAssetPresetUrl(
  publicId: string,
  preset: string,
  options: IUseAssetPresetUrlOptions = {},
): IUseAssetPresetUrlResult {
  const ctxClient = useContext(_LafkenClientContext);
  const client: LafkenClient | null = options.client ?? ctxClient;
  if (client === null) {
    throw new Error(
      "useAssetPresetUrl requires either a `client` option or a <LafkenProvider> ancestor",
    );
  }

  const key: string = `${publicId}|${preset}`;
  const [state, setState] = useState<IFetchState>({
    key,
    url: null,
    isLoading: true,
    error: null,
  });

  // When the key changes, the next render must NOT show stale data from the
  // previous key. We compute the visible state from the current key and only
  // commit to the new state once the matching effect resolves.
  const visibleState: IFetchState =
    state.key === key ? state : { key, url: null, isLoading: true, error: null };

  useEffect(() => {
    let cancelled = false;
    const promise: Promise<string> = _getCachedPresetUrl(client, publicId, preset);
    promise.then(
      (resolved: string) => {
        if (!cancelled) setState({ key, url: resolved, isLoading: false, error: null });
      },
      (err: unknown) => {
        if (!cancelled) {
          const wrapped: Error = err instanceof Error ? err : new Error(String(err));
          setState({ key, url: null, isLoading: false, error: wrapped });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [client, publicId, preset, key]);

  return { url: visibleState.url, isLoading: visibleState.isLoading, error: visibleState.error };
}
