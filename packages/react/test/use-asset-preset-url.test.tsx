import type { LafkenClient } from "@lafken/client";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { _resetPresetUrlCache, LafkenProvider, useAssetPresetUrl } from "../src/index";

function makeStubClient(impl: {
  getPreviewUrl: (i: { publicId: string; preset: string }) => Promise<string>;
}): LafkenClient {
  return impl as unknown as LafkenClient;
}

afterEach(() => {
  _resetPresetUrlCache();
});

describe("useAssetPresetUrl", () => {
  it("returns the resolved URL after the fetch settles", async () => {
    const client = makeStubClient({
      getPreviewUrl: vi.fn().mockResolvedValue("https://cdn/x.webp"),
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
    const fn = vi.fn().mockResolvedValue("https://cdn/x.webp");
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
      getPreviewUrl: vi.fn().mockResolvedValue("https://cdn/y.webp"),
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
});
