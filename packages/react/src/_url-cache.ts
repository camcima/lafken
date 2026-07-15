import type { LafkenClient } from "@lafken/client";

/**
 * Module-level TTL-aware dedup cache shared between <AssetImage> and useAssetPresetUrl.
 * Keys are `${publicId}|${preset}` so the same (asset, preset) pair resolves
 * exactly one in-flight request, no matter how many components subscribe.
 *
 * When a cached URL is within REFRESH_THRESHOLD_MS of expiry, a background
 * refresh is triggered; the stale URL is returned synchronously in the meantime.
 * When a URL is already expired (or not cached at all), a fresh fetch is issued
 * and deduplicated across concurrent callers.
 *
 * Failed initial fetches evict themselves so a transient 4xx/5xx doesn't
 * poison the cache forever. Failed background refreshes leave the stale entry
 * in place.
 */

interface ICacheEntry {
  url: string;
  expiresAt: number;
  /**
   * In-flight promise for the initial fetch OR a background refresh.
   * For the initial fetch: callers should await this promise instead of `url`
   * (url is "" and expiresAt is 0 while the initial fetch is in flight).
   * For a background refresh: callers get the cached url synchronously; this
   * exists only to deduplicate concurrent background refresh triggers.
   */
  refreshPromise?: Promise<string>;
}

/** Start a background refresh when the URL expires within this window (1 minute). */
const REFRESH_THRESHOLD_MS = 60_000;

const cache: Map<string, ICacheEntry> = new Map();

/** Payload of the `cache-updated` event. */
export interface ICacheUpdatedDetail {
  key: string;
  url: string;
}

/**
 * Module-level EventTarget that fires a `cache-updated` event whenever a fetch
 * (initial or background refresh) resolves. <AssetImage> and useAssetPresetUrl
 * subscribe to this to swap the displayed URL without a full remount.
 *
 * The resolved URL travels *in the event*. Subscribers must render it directly
 * and must never call back into `_getCachedPresetUrl` from their listener: a
 * re-read would find the just-written entry expired (unparseable `expiresAt`)
 * or inside REFRESH_THRESHOLD_MS (a sub-minute TTL), issue another fetch, and
 * dispatch again — an unbounded, event-loop-starving request storm.
 */
export const cacheUpdateBus: EventTarget = new EventTarget();

function doFetch(
  client: LafkenClient,
  publicId: string,
  preset: string,
  key: string,
): Promise<string> {
  const promise: Promise<string> = client.assets.getPreviewUrl({ publicId, preset }).then((dto) => {
    const parsed: number = Date.parse(dto.expiresAt);
    // An unparseable expiresAt must never poison the entry as permanently
    // fresh (NaN comparisons are always false). Treat it as already expired:
    // callers still get the URL, but the next access refetches.
    const expiresAt: number = Number.isNaN(parsed) ? 0 : parsed;
    // Write the resolved entry (clearing the refreshPromise)
    cache.set(key, { url: dto.url, expiresAt });
    const detail: ICacheUpdatedDetail = { key, url: dto.url };
    cacheUpdateBus.dispatchEvent(new CustomEvent<ICacheUpdatedDetail>("cache-updated", { detail }));
    return dto.url;
  });
  return promise;
}

/**
 * Drops expired entries that have no refresh in flight. Runs on every cache
 * access so the map cannot grow without bound (F-K5). Entries with an active
 * refreshPromise are protected — including initial-fetch placeholders.
 */
function evictExpiredEntries(now: number): void {
  for (const [entryKey, entry] of cache) {
    if (entry.refreshPromise === undefined && entry.expiresAt <= now) {
      cache.delete(entryKey);
    }
  }
}

export function _getCachedPresetUrl(
  client: LafkenClient,
  publicId: string,
  preset: string,
): Promise<string> {
  const key: string = `${publicId}|${preset}`;
  const now = Date.now();
  evictExpiredEntries(now);
  const entry: ICacheEntry | undefined = cache.get(key);

  // No entry at all — start initial fetch, deduplicate concurrent callers
  if (entry === undefined) {
    const fresh = doFetch(client, publicId, preset, key);
    // Store a placeholder so concurrent calls share the same promise
    cache.set(key, { url: "", expiresAt: 0, refreshPromise: fresh });
    fresh.catch(() => {
      // Evict placeholder on initial fetch failure
      const current = cache.get(key);
      if (current?.refreshPromise === fresh) {
        cache.delete(key);
      }
    });
    return fresh;
  }

  // Initial fetch still in flight (url is "" and expiresAt is 0) — share the promise
  if (entry.url === "" && entry.expiresAt === 0 && entry.refreshPromise !== undefined) {
    return entry.refreshPromise;
  }

  // Entry is expired yet survived the sweep above. That is only possible with a
  // refresh already in flight: evictExpiredEntries() — called with this same
  // `now`, so there is no clock-drift loophole — dropped every other expired
  // entry, and the map cannot have changed in between. Reuse the in-flight
  // promise rather than issuing a duplicate fetch.
  if (entry.expiresAt <= now && entry.refreshPromise !== undefined) {
    return entry.refreshPromise;
  }

  // Within threshold — trigger background refresh (deduplicated) and return current URL synchronously
  if (entry.expiresAt - now < REFRESH_THRESHOLD_MS && entry.refreshPromise === undefined) {
    const refreshPromise = doFetch(client, publicId, preset, key);
    cache.set(key, { ...entry, refreshPromise });
    refreshPromise.catch(() => {
      // Clear refreshPromise flag so a future call can retry
      const current = cache.get(key);
      if (current?.refreshPromise === refreshPromise) {
        cache.set(key, { url: current.url, expiresAt: current.expiresAt });
      }
    });
  }

  return Promise.resolve(entry.url);
}

/** Evict a cache entry for the given (publicId, preset) pair. */
export function _evictPresetUrl(publicId: string, preset: string): void {
  cache.delete(`${publicId}|${preset}`);
}

/** Test-only — reset the dedup cache between tests. */
export function _resetPresetUrlCache(): void {
  cache.clear();
}

/** Test-only — current number of cache entries (for eviction assertions). */
export function _presetUrlCacheSize(): number {
  return cache.size;
}
