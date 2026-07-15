import { afterEach, describe, expect, it, vi } from "vitest";

import {
  _evictPresetUrl,
  _getCachedPresetUrl,
  _presetUrlCacheSize,
  _resetPresetUrlCache,
} from "../src/_url-cache";

function makeClient(impl: {
  getPreviewUrl: (i: {
    publicId: string;
    preset: string;
  }) => Promise<{ url: string; expiresAt: string }>;
}): Parameters<typeof _getCachedPresetUrl>[0] {
  return { assets: impl } as unknown as Parameters<typeof _getCachedPresetUrl>[0];
}

afterEach(() => {
  _resetPresetUrlCache();
  vi.useRealTimers();
});

describe("_getCachedPresetUrl TTL cache", () => {
  it("returns cached URL synchronously when not near expiry and triggers no extra fetch", async () => {
    const getPreviewUrl = vi.fn().mockResolvedValue({
      url: "https://cdn/first.webp",
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(), // far future
    });
    const client = makeClient({ getPreviewUrl });

    // First call — fetches
    const url1 = await _getCachedPresetUrl(client, "abc", "thumb");
    expect(url1).toBe("https://cdn/first.webp");
    expect(getPreviewUrl).toHaveBeenCalledTimes(1);

    // Second call — returns cached value, no extra fetch
    const url2 = await _getCachedPresetUrl(client, "abc", "thumb");
    expect(url2).toBe("https://cdn/first.webp");
    expect(getPreviewUrl).toHaveBeenCalledTimes(1);
  });

  it("returns current URL synchronously but triggers background refresh when within threshold", async () => {
    vi.useFakeTimers();
    const now = Date.now();

    // First fetch: expiresAt is 30 seconds from now (within the 60s REFRESH_THRESHOLD_MS)
    const firstGetPreviewUrl = vi.fn().mockResolvedValue({
      url: "https://cdn/first.webp",
      expiresAt: new Date(now + 30_000).toISOString(),
    });
    const secondGetPreviewUrl = vi.fn().mockResolvedValue({
      url: "https://cdn/refreshed.webp",
      expiresAt: new Date(now + 3_600_000).toISOString(),
    });

    let callCount = 0;
    const getPreviewUrl = vi.fn().mockImplementation(() => {
      callCount++;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      if (callCount === 1) return firstGetPreviewUrl();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return secondGetPreviewUrl();
    });

    const client = makeClient({ getPreviewUrl });

    // Initial fetch
    const url1 = await _getCachedPresetUrl(client, "abc", "thumb");
    expect(url1).toBe("https://cdn/first.webp");

    // Now the entry is cached but within threshold (30s < 60s).
    // Second call should return the cached URL synchronously AND trigger a background refresh.
    const url2Promise = _getCachedPresetUrl(client, "abc", "thumb");
    // Must resolve synchronously (cached), so we can use Promise.resolve trick:
    let syncResult: string | undefined;
    void url2Promise.then((v) => {
      syncResult = v;
    });
    await Promise.resolve(); // flush microtasks
    expect(syncResult).toBe("https://cdn/first.webp");

    // Let the background refresh resolve
    await vi.runAllTimersAsync();

    // After background refresh, a subsequent call should return the new URL
    const url3 = await _getCachedPresetUrl(client, "abc", "thumb");
    expect(url3).toBe("https://cdn/refreshed.webp");
    expect(getPreviewUrl).toHaveBeenCalledTimes(2);
  });

  it("deduplicates concurrent background refreshes (single in-flight promise)", async () => {
    vi.useFakeTimers();
    const now = Date.now();

    let refreshCount = 0;
    const getPreviewUrl = vi.fn().mockImplementation(() => {
      refreshCount++;
      return Promise.resolve({
        url: `https://cdn/v${refreshCount}.webp`,
        expiresAt: new Date(now + (refreshCount === 1 ? 30_000 : 3_600_000)).toISOString(),
      });
    });

    const client = makeClient({ getPreviewUrl });

    // Seed the cache with a near-expiry entry
    await _getCachedPresetUrl(client, "abc", "thumb");
    expect(refreshCount).toBe(1);

    // Two concurrent calls should only trigger one background refresh
    const p1 = _getCachedPresetUrl(client, "abc", "thumb");
    const p2 = _getCachedPresetUrl(client, "abc", "thumb");

    await vi.runAllTimersAsync();
    const [u1, u2] = await Promise.all([p1, p2]);

    // Both return the cached URL (not the refreshed one yet, since refresh is in-flight)
    expect(u1).toBe("https://cdn/v1.webp");
    expect(u2).toBe("https://cdn/v1.webp");

    // Only one extra refresh was triggered despite two concurrent calls
    expect(refreshCount).toBe(2);
  });

  it("_evictPresetUrl clears the cache entry", async () => {
    const getPreviewUrl = vi
      .fn()
      .mockResolvedValueOnce({
        url: "https://cdn/v1.webp",
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      })
      .mockResolvedValueOnce({
        url: "https://cdn/v2.webp",
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      });

    const client = makeClient({ getPreviewUrl });

    const url1 = await _getCachedPresetUrl(client, "abc", "thumb");
    expect(url1).toBe("https://cdn/v1.webp");
    expect(getPreviewUrl).toHaveBeenCalledTimes(1);

    _evictPresetUrl("abc", "thumb");

    // After eviction, a new fetch is triggered
    const url2 = await _getCachedPresetUrl(client, "abc", "thumb");
    expect(url2).toBe("https://cdn/v2.webp");
    expect(getPreviewUrl).toHaveBeenCalledTimes(2);
  });

  it("treats an unparseable expiresAt as already expired instead of permanently fresh", async () => {
    const getPreviewUrl = vi
      .fn()
      .mockResolvedValueOnce({ url: "https://cdn/bad.webp", expiresAt: "not-a-date" })
      .mockResolvedValueOnce({
        url: "https://cdn/good.webp",
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      });
    const client = makeClient({ getPreviewUrl });

    // First fetch returns the URL but must not cache it as fresh forever.
    expect(await _getCachedPresetUrl(client, "abc", "thumb")).toBe("https://cdn/bad.webp");
    // Next access refetches instead of serving the poisoned entry.
    expect(await _getCachedPresetUrl(client, "abc", "thumb")).toBe("https://cdn/good.webp");
    expect(getPreviewUrl).toHaveBeenCalledTimes(2);
  });

  it("does not evict an expired entry whose refresh is still in flight", async () => {
    vi.useFakeTimers();
    const now = Date.now();
    let resolveRefresh: (dto: { url: string; expiresAt: string }) => void = () => {};

    const getPreviewUrl = vi
      .fn()
      // "a|thumb" — inside the 60s refresh threshold, so the next access
      // kicks off a background refresh.
      .mockResolvedValueOnce({
        url: "https://cdn/a1.webp",
        expiresAt: new Date(now + 30_000).toISOString(),
      })
      // The background refresh — deliberately never settles on its own.
      .mockImplementationOnce(
        () =>
          new Promise<{ url: string; expiresAt: string }>((resolve) => {
            resolveRefresh = resolve;
          }),
      )
      .mockResolvedValue({
        url: "https://cdn/b.webp",
        expiresAt: new Date(now + 3_600_000).toISOString(),
      });

    const client = makeClient({ getPreviewUrl });

    await _getCachedPresetUrl(client, "a", "thumb");
    // Second access: within threshold -> background refresh starts, stale URL returned.
    expect(await _getCachedPresetUrl(client, "a", "thumb")).toBe("https://cdn/a1.webp");
    expect(getPreviewUrl).toHaveBeenCalledTimes(2);

    // "a|thumb" is now past its expiry, but its refresh is still in flight.
    vi.setSystemTime(now + 60_000);

    // Any access runs the sweep. The in-flight refresh must protect the entry —
    // dropping it would orphan the pending request and let a duplicate fetch fire.
    await _getCachedPresetUrl(client, "b", "thumb");
    expect(_presetUrlCacheSize()).toBe(2);

    // The protected entry still shares its in-flight promise instead of
    // issuing a fourth request.
    const shared = _getCachedPresetUrl(client, "a", "thumb");
    expect(getPreviewUrl).toHaveBeenCalledTimes(3);

    resolveRefresh({
      url: "https://cdn/a2.webp",
      expiresAt: new Date(now + 3_600_000).toISOString(),
    });
    await expect(shared).resolves.toBe("https://cdn/a2.webp");
  });

  it("evicts expired entries on access", async () => {
    vi.useFakeTimers();
    const getPreviewUrl = vi.fn().mockImplementation(({ publicId }: { publicId: string }) =>
      Promise.resolve({
        url: `https://cdn/${publicId}.webp`,
        expiresAt: new Date(Date.now() + 1_000).toISOString(),
      }),
    );
    const client = makeClient({ getPreviewUrl });

    await _getCachedPresetUrl(client, "a", "thumb");
    expect(_presetUrlCacheSize()).toBe(1);

    vi.advanceTimersByTime(5_000); // "a|thumb" is now expired

    await _getCachedPresetUrl(client, "b", "thumb");
    // Accessing "b" swept the expired "a|thumb" entry; only "b|thumb" remains.
    expect(_presetUrlCacheSize()).toBe(1);
    expect(getPreviewUrl).toHaveBeenCalledTimes(2);
  });
});
