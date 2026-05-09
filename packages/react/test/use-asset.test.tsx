import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { LafkenProvider, useAsset } from "../src/index";

function makeAsset(publicId: string): Record<string, unknown> {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    publicId,
    state: "ready",
    mimeType: "image/jpeg",
    sizeBytes: 1024,
    namespaceSlug: "default",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as unknown as AssetResponseDTO;
}

function makeWrapper(
  client: Parameters<typeof LafkenProvider>[0]["client"],
): ({ children }: { children: ReactNode }) => React.JSX.Element {
  return function Wrapper({ children }: { children: ReactNode }): React.JSX.Element {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return (
      <QueryClientProvider client={queryClient}>
        <LafkenProvider client={client}>{children}</LafkenProvider>
      </QueryClientProvider>
    );
  };
}

describe("useAsset", () => {
  it("calls client.assets.get once and returns the asset", async () => {
    const asset = makeAsset("abc-123");
    const getFn = vi.fn().mockResolvedValue(asset);
    const client = { assets: { get: getFn } } as unknown as Parameters<
      typeof LafkenProvider
    >[0]["client"];

    const { result } = renderHook(() => useAsset("abc-123"), {
      wrapper: makeWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(getFn).toHaveBeenCalledTimes(1);
    expect(getFn).toHaveBeenCalledWith("abc-123");
    expect(result.current.data).toEqual(asset);
  });

  it("starts with isLoading=true and data=undefined", () => {
    const getFn = vi.fn().mockReturnValue(new Promise(() => {}));
    const client = { assets: { get: getFn } } as unknown as Parameters<
      typeof LafkenProvider
    >[0]["client"];

    const { result } = renderHook(() => useAsset("abc-123"), {
      wrapper: makeWrapper(client),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it("sets error on failure and refetch re-issues the call", async () => {
    const error = new Error("network error");
    const getFn = vi.fn().mockRejectedValue(error);
    const client = { assets: { get: getFn } } as unknown as Parameters<
      typeof LafkenProvider
    >[0]["client"];

    const { result } = renderHook(() => useAsset("abc-123"), {
      wrapper: makeWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBe(error);
    const callsBefore = getFn.mock.calls.length;
    getFn.mockResolvedValueOnce(makeAsset("abc-123"));
    await result.current.refetch();
    expect(getFn.mock.calls.length).toBeGreaterThan(callsBefore);
  });
});
