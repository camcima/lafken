import type { LafkenClient } from "@lafken/client";
import { act, cleanup, render, renderHook } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { _resetPresetUrlCache, AssetImage, LafkenProvider, useAssetPresetUrl } from "../src/index";

/**
 * Regression suite for the preview-URL refresh storm.
 *
 * A subscriber that reacts to `cache-updated` by re-reading the cache closes a
 * feedback loop: fetch -> cache.set -> dispatch -> listener re-reads -> the
 * entry looks expired (or near-expiry) -> another fetch -> dispatch -> ...
 * With an unparseable or short-lived `expiresAt` that loop never settles, and
 * because every hop is a microtask it starves the event loop rather than
 * merely being slow.
 *
 * The stubs below therefore hand back a "needs refresh" expiresAt only for the
 * first LOOP_BREAKER calls and a far-future one afterwards. That turns the
 * (buggy) infinite chain into a finite one so these tests can *fail with a
 * count* instead of hanging the runner.
 */
const LOOP_BREAKER = 12;

function farFuture(): string {
  return new Date(Date.now() + 3_600_000).toISOString();
}

function makeStubClient(getPreviewUrl: ReturnType<typeof vi.fn>): LafkenClient {
  return { assets: { getPreviewUrl } } as unknown as LafkenClient;
}

/** A client whose preview URLs always carry an unparseable `expiresAt`. */
function clientWithUnparseableExpiry(): {
  client: LafkenClient;
  getPreviewUrl: ReturnType<typeof vi.fn>;
} {
  let calls = 0;
  const getPreviewUrl = vi.fn().mockImplementation(() => {
    calls += 1;
    return Promise.resolve({
      url: `https://cdn/v${calls}.webp`,
      expiresAt: calls > LOOP_BREAKER ? farFuture() : "not-a-date",
    });
  });
  return { client: makeStubClient(getPreviewUrl), getPreviewUrl };
}

/** A client whose preview URLs expire in 5s — legal (`signedUrlTtlSeconds` is @Min(1)). */
function clientWithShortTtl(): {
  client: LafkenClient;
  getPreviewUrl: ReturnType<typeof vi.fn>;
} {
  let calls = 0;
  const getPreviewUrl = vi.fn().mockImplementation(() => {
    calls += 1;
    return Promise.resolve({
      url: `https://cdn/v${calls}.webp`,
      expiresAt: calls > LOOP_BREAKER ? farFuture() : new Date(Date.now() + 5_000).toISOString(),
    });
  });
  return { client: makeStubClient(getPreviewUrl), getPreviewUrl };
}

function wrapperFor(client: LafkenClient) {
  return function Wrapper({ children }: { children: React.ReactNode }): React.JSX.Element {
    return <LafkenProvider client={client}>{children}</LafkenProvider>;
  };
}

/** Let every queued microtask and timer callback run to completion. */
async function settle(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
}

beforeEach(() => {
  _resetPresetUrlCache();
  vi.useFakeTimers();
});

afterEach(() => {
  // This package does not enable Vitest `globals`, so @testing-library/react's
  // auto-cleanup is NOT registered. Without an explicit unmount, a previous
  // test's subscriber stays attached to the module-level cacheUpdateBus and
  // services the next test's cache-updated events with its own (already
  // loop-broken) client — masking the very storm these tests exist to catch.
  cleanup();
  vi.useRealTimers();
  _resetPresetUrlCache();
});

describe("preview-URL cache does not storm the API", () => {
  it("issues exactly one request for an idle useAssetPresetUrl when expiresAt is unparseable", async () => {
    const { client, getPreviewUrl } = clientWithUnparseableExpiry();
    renderHook(() => useAssetPresetUrl("abc", "thumb"), { wrapper: wrapperFor(client) });

    await settle();

    expect(getPreviewUrl).toHaveBeenCalledTimes(1);
  });

  it("issues exactly one request for an idle <AssetImage> when expiresAt is unparseable", async () => {
    const { client, getPreviewUrl } = clientWithUnparseableExpiry();
    render(
      <LafkenProvider client={client}>
        <AssetImage publicId="abc" preset="thumb" alt="" />
      </LafkenProvider>,
    );

    await settle();

    expect(getPreviewUrl).toHaveBeenCalledTimes(1);
  });

  it("issues exactly one request for an idle useAssetPresetUrl when the TTL is under a minute", async () => {
    const { client, getPreviewUrl } = clientWithShortTtl();
    renderHook(() => useAssetPresetUrl("abc", "thumb"), { wrapper: wrapperFor(client) });

    await settle();

    expect(getPreviewUrl).toHaveBeenCalledTimes(1);
  });

  it("issues exactly one request for an idle <AssetImage> when the TTL is under a minute", async () => {
    const { client, getPreviewUrl } = clientWithShortTtl();
    render(
      <LafkenProvider client={client}>
        <AssetImage publicId="abc" preset="thumb" alt="" />
      </LafkenProvider>,
    );

    await settle();

    expect(getPreviewUrl).toHaveBeenCalledTimes(1);
  });

  it("shows the resolved URL even though the entry is immediately stale", async () => {
    const { client } = clientWithUnparseableExpiry();
    const { result } = renderHook(() => useAssetPresetUrl("abc", "thumb"), {
      wrapper: wrapperFor(client),
    });

    await settle();

    expect(result.current.url).toBe("https://cdn/v1.webp");
    expect(result.current.isLoading).toBe(false);
  });
});
