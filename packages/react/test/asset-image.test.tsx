import { act, render, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { _resetAssetImageCache, AssetImage, LafkenProvider } from "../src/index";

function makePreviewUrlDto(url: string): { url: string; expiresAt: string } {
  return { url, expiresAt: new Date(Date.now() + 3_600_000).toISOString() };
}

function makeStubClient(impl: {
  getPreviewUrl: (i: {
    publicId: string;
    preset: string;
  }) => Promise<{ url: string; expiresAt: string }>;
}) {
  return {
    assets: impl,
  } as unknown as Parameters<typeof LafkenProvider>[0]["client"];
}

afterEach(() => {
  _resetAssetImageCache();
});

describe("<AssetImage>", () => {
  it("renders an <img> with the resolved URL", async () => {
    const client = makeStubClient({
      getPreviewUrl: vi.fn().mockResolvedValue(makePreviewUrlDto("https://cdn/x.webp")),
    });
    const { container } = render(
      <LafkenProvider client={client}>
        <AssetImage publicId="abc" preset="lafken:thumbnail" alt="a" />
      </LafkenProvider>,
    );
    await waitFor(() => {
      expect(container.querySelector("img")).not.toBeNull();
    });
    const img = container.querySelector("img")!;
    expect(img.getAttribute("src")).toBe("https://cdn/x.webp");
    expect(img.getAttribute("alt")).toBe("a");
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(img.getAttribute("decoding")).toBe("async");
  });

  it("renders nothing while loading", () => {
    const client = makeStubClient({
      getPreviewUrl: vi.fn().mockReturnValue(new Promise(() => {})),
    });
    const { container } = render(
      <LafkenProvider client={client}>
        <AssetImage publicId="abc" preset="lafken:thumbnail" alt="" />
      </LafkenProvider>,
    );
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders nothing on error (e.g., 404)", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("404"));
    const client = makeStubClient({ getPreviewUrl: fn });
    const { container } = render(
      <LafkenProvider client={client}>
        <AssetImage publicId="abc" preset="missing" alt="" />
      </LafkenProvider>,
    );
    await waitFor(() => {
      expect(fn.mock.calls.length).toBe(1);
    });
    expect(container.querySelector("img")).toBeNull();
  });

  it("dedupes concurrent fetches across multiple mounts of the same key", async () => {
    const fn = vi.fn().mockResolvedValue(makePreviewUrlDto("https://cdn/x.webp"));
    const client = makeStubClient({ getPreviewUrl: fn });
    render(
      <LafkenProvider client={client}>
        <AssetImage publicId="abc" preset="lafken:thumbnail" alt="" />
        <AssetImage publicId="abc" preset="lafken:thumbnail" alt="" />
        <AssetImage publicId="abc" preset="lafken:thumbnail" alt="" />
      </LafkenProvider>,
    );
    await waitFor(() => {
      expect(fn.mock.calls.length).toBe(1);
    });
  });

  it("accepts a client prop override (no provider)", async () => {
    const client = makeStubClient({
      getPreviewUrl: vi.fn().mockResolvedValue(makePreviewUrlDto("https://cdn/y.webp")),
    });
    const { container } = render(
      <AssetImage
        client={client as Parameters<typeof AssetImage>[0]["client"]}
        publicId="abc"
        preset="lafken:thumbnail"
        alt=""
      />,
    );
    await waitFor(() => {
      expect(container.querySelector("img")).not.toBeNull();
    });
  });

  it("throws when used without a provider and without a client prop", () => {
    // Suppress the noisy React error boundary log.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => render(<AssetImage publicId="abc" preset="lafken:thumbnail" alt="" />)).toThrow(
        /LafkenProvider|client/u,
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("forwards arbitrary <img> attributes", async () => {
    const client = makeStubClient({
      getPreviewUrl: vi.fn().mockResolvedValue(makePreviewUrlDto("https://cdn/x.webp")),
    });
    const { container } = render(
      <LafkenProvider client={client}>
        <AssetImage
          publicId="abc"
          preset="lafken:thumbnail"
          className="foo"
          data-testid="bar"
          alt=""
        />
      </LafkenProvider>,
    );
    await waitFor(() => {
      expect(container.querySelector("img")).not.toBeNull();
    });
    const img = container.querySelector("img")!;
    expect(img.getAttribute("class")).toBe("foo");
    expect(img.getAttribute("data-testid")).toBe("bar");
  });

  it("swaps src after a background refresh resolves via cache-updated event", async () => {
    // Strategy: seed the cache manually with a near-expiry URL using _getCachedPresetUrl
    // on its own, then render the component and trigger a second read that kicks off
    // the background refresh.
    // Use unique keys to avoid pollution from other tests.
    const { _getCachedPresetUrl: getCachedPresetUrl } = await import("../src/_url-cache");

    const nearExpiry = new Date(Date.now() + 30_000).toISOString(); // 30s < 60s threshold
    const farFuture = new Date(Date.now() + 3_600_000).toISOString();

    let callCount = 0;
    const fn = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1)
        return Promise.resolve({ url: "https://cdn/v1.webp", expiresAt: nearExpiry });
      return Promise.resolve({ url: "https://cdn/v2.webp", expiresAt: farFuture });
    });

    const client = makeStubClient({ getPreviewUrl: fn });
    const typedClient = client as unknown as Parameters<typeof getCachedPresetUrl>[0];

    // Step 1: seed the cache with v1 (near-expiry)
    await getCachedPresetUrl(typedClient, "swap-test", "lafken:thumbnail");
    expect(fn).toHaveBeenCalledTimes(1);

    // Step 2: render the component — it reads from cache (v1) synchronously, no new fetch
    const { container } = render(
      <LafkenProvider client={client}>
        <AssetImage publicId="swap-test" preset="lafken:thumbnail" alt="" />
      </LafkenProvider>,
    );

    await waitFor(() => {
      expect(container.querySelector("img")).not.toBeNull();
    });
    // The component may have triggered the background refresh via its own _getCachedPresetUrl call
    // in useEffect. Wait for the URL to stabilize.
    await waitFor(() => {
      const src = container.querySelector("img")!.getAttribute("src");
      expect(src === "https://cdn/v1.webp" || src === "https://cdn/v2.webp").toBe(true);
    });

    // Step 3: explicitly trigger a background refresh if not already in flight
    await act(async () => {
      await getCachedPresetUrl(typedClient, "swap-test", "lafken:thumbnail");
    });

    // Step 4: the background refresh resolves and emits cache-updated;
    // the component should eventually display the refreshed URL.
    await waitFor(() => {
      expect(container.querySelector("img")!.getAttribute("src")).toBe("https://cdn/v2.webp");
    });
    // getPreviewUrl was called twice total (initial seed + background refresh)
    expect(fn.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("evicts cache and retries once on img onError; renders nothing if retry also fails", async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce({
        url: "https://cdn/v1.webp",
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      })
      .mockRejectedValue(new Error("retry-also-failed"));

    const client = makeStubClient({ getPreviewUrl: fn });

    const { container } = render(
      <LafkenProvider client={client}>
        <AssetImage publicId="abc" preset="lafken:thumbnail" alt="" />
      </LafkenProvider>,
    );

    await waitFor(() => {
      expect(container.querySelector("img")).not.toBeNull();
    });

    // Simulate the <img> element itself failing to load the URL
    const img = container.querySelector("img")!;
    act(() => {
      img.dispatchEvent(new Event("error"));
    });

    // Component should evict and retry — the retry also fails, so it renders nothing
    await waitFor(() => {
      expect(container.querySelector("img")).toBeNull();
    });

    // The retry (2nd call to getPreviewUrl) should have been triggered
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
