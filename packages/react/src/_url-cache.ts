import type { LafkenClient } from "@lafken/client";

/**
 * Module-level dedup cache shared between <AssetImage> and useAssetPresetUrl.
 * Keys are `${publicId}|${preset}` so the same (asset, preset) pair resolves
 * exactly one in-flight request, no matter how many components subscribe.
 *
 * Failed promises evict themselves so a transient 4xx/5xx doesn't poison the
 * cache forever. Successes stay cached for the lifetime of the page — preview
 * URLs are short-lived enough that the page outlives them only on rare,
 * long-idle tabs, which is acceptable.
 */
const cache: Map<string, Promise<string>> = new Map();

export function _getCachedPresetUrl(
  client: LafkenClient,
  publicId: string,
  preset: string,
): Promise<string> {
  const key: string = `${publicId}|${preset}`;
  const existing: Promise<string> | undefined = cache.get(key);
  if (existing !== undefined) return existing;
  const fresh: Promise<string> = client.getPreviewUrl({ publicId, preset });
  cache.set(key, fresh);
  fresh.catch(() => {
    cache.delete(key);
  });
  return fresh;
}

/** Test-only — reset the dedup cache between tests. */
export function _resetPresetUrlCache(): void {
  cache.clear();
}
