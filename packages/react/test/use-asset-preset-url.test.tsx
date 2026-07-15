import type { LafkenClient } from "@lafken/client";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { _evictPresetUrl, _getCachedPresetUrl } from "../src/_url-cache";
import { _resetPresetUrlCache, LafkenProvider, useAssetPresetUrl } from "../src/index";

function makePreviewUrlDto(url: string): { url: string; expiresAt: string } {
  return { url, expiresAt: new Date(Date.now() + 3_600_000).toISOString() };
}

function makeStubClient(impl: {
  getPreviewUrl: (i: {
    publicId: string;
    preset: string;
  }) => Promise<{ url: string; expiresAt: string }>;
}): LafkenClient {
  return {
    assets: impl,
  } as unknown as LafkenClient;
}

afterEach(() => {
  _resetPresetUrlCache();
});

describe("useAssetPresetUrl", () => {
  it("returns the resolved URL after the fetch settles", async () => {
    const client = makeStubClient({
      getPreviewUrl: vi.fn().mockResolvedValue(makePreviewUrlDto("https://cdn/x.webp")),
    });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LafkenProvider client={client}>{children}</LafkenProvider>
    );
    const { result } = renderHook(() => useAssetPresetUrl("abc", "lafken:thumbnail"), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.url).toBeNull();
    expect(result.current.error).toBeNull();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.url).toBe("https://cdn/x.webp");
    expect(result.current.error).toBeNull();
  });

  it("returns the error when the fetch rejects", async () => {
    const error = new Error("404 Not Found");
    const client = makeStubClient({
      getPreviewUrl: vi.fn().mockRejectedValue(error),
    });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LafkenProvider client={client}>{children}</LafkenProvider>
    );
    const { result } = renderHook(() => useAssetPresetUrl("abc", "missing"), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.url).toBeNull();
    expect(result.current.error).toBe(error);
  });

  it("dedupes concurrent fetches for the same (publicId, preset) pair", async () => {
    const fn = vi.fn().mockResolvedValue(makePreviewUrlDto("https://cdn/x.webp"));
    const client = makeStubClient({ getPreviewUrl: fn });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LafkenProvider client={client}>{children}</LafkenProvider>
    );
    renderHook(() => useAssetPresetUrl("abc", "lafken:thumbnail"), { wrapper });
    renderHook(() => useAssetPresetUrl("abc", "lafken:thumbnail"), { wrapper });
    renderHook(() => useAssetPresetUrl("abc", "lafken:thumbnail"), { wrapper });

    await waitFor(() => {
      expect(fn.mock.calls.length).toBe(1);
    });
  });

  it("accepts a client option override (no provider)", async () => {
    const client = makeStubClient({
      getPreviewUrl: vi.fn().mockResolvedValue(makePreviewUrlDto("https://cdn/y.webp")),
    });
    const { result } = renderHook(() => useAssetPresetUrl("abc", "lafken:thumbnail", { client }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.url).toBe("https://cdn/y.webp");
  });

  it("throws when used without a provider and without a client option", () => {
    // Suppress the noisy React error boundary log.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => renderHook(() => useAssetPresetUrl("abc", "lafken:thumbnail"))).toThrow(
        /LafkenProvider|client/u,
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("updates to the refreshed URL after a background refresh completes", async () => {
    // The initial entry deliberately sits *inside* the 60s refresh threshold.
    // The hook subscribes to "cache-updated", which `doFetch` dispatches for
    // every fetch — including the initial one. A listener that reacted by
    // re-reading the cache would find this near-expiry entry, trigger another
    // fetch, dispatch again, and storm the API. Because the listener now takes
    // the URL straight from the event, the initial dispatch is inert and this
    // test deterministically observes "stale" before the explicit refresh.
    const getPreviewUrl = vi
      .fn()
      .mockResolvedValueOnce({
        url: "https://cdn/stale.webp",
        expiresAt: new Date(Date.now() + 30_000).toISOString(),
      })
      .mockResolvedValueOnce({
        url: "https://cdn/fresh.webp",
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      });
    const client = makeStubClient({ getPreviewUrl });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LafkenProvider client={client}>{children}</LafkenProvider>
    );
    const { result } = renderHook(() => useAssetPresetUrl("abc", "thumb"), { wrapper });

    await waitFor(() => {
      expect(result.current.url).toBe("https://cdn/stale.webp");
    });

    // Simulate another consumer (e.g. <AssetImage> re-fetching after an
    // eviction) refreshing the same key; the hook must pick up the new URL
    // via the cacheUpdateBus subscription — exactly like <AssetImage> does.
    _evictPresetUrl("abc", "thumb");
    await act(async () => {
      await _getCachedPresetUrl(client, "abc", "thumb");
    });

    await waitFor(() => {
      expect(result.current.url).toBe("https://cdn/fresh.webp");
    });
    expect(getPreviewUrl).toHaveBeenCalledTimes(2);
  });
});
