import type { LafkenClient } from "@lafken/client";
import { useContext, useEffect, useState } from "react";

import { _getCachedPresetUrl, cacheUpdateBus, type ICacheUpdatedDetail } from "./_url-cache";
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
        if (cancelled) return;
        // This read can resolve with a stale-but-valid URL *after* a refresh it
        // itself triggered has already been delivered over the bus. Any URL
        // already present for this key came from a later cache write, so never
        // move backwards.
        setState((prev) =>
          prev.key === key && prev.url !== null
            ? prev
            : { key, url: resolved, isLoading: false, error: null },
        );
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

  // Subscribe to refresh completions so the returned URL stays valid past its
  // TTL — the same pattern <AssetImage> uses (F-K5).
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
    const onCacheUpdated = (ev: Event): void => {
      const detail: ICacheUpdatedDetail = (ev as CustomEvent<ICacheUpdatedDetail>).detail;
      if (detail.key !== key) return;
      setState((prev) =>
        prev.key === key ? { key, url: detail.url, isLoading: false, error: null } : prev,
      );
    };
    cacheUpdateBus.addEventListener("cache-updated", onCacheUpdated);
    return () => {
      cacheUpdateBus.removeEventListener("cache-updated", onCacheUpdated);
    };
  }, [key]);

  return { url: visibleState.url, isLoading: visibleState.isLoading, error: visibleState.error };
}
