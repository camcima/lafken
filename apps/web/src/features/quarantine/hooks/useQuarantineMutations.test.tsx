import type { AssetResponseDTO } from "@shared/backend-api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { assetsKeys } from "@/features/assets/keys";
import { auditKeys } from "@/features/audit/keys";
import { dashboardKeys } from "@/features/dashboard/keys";
import { quarantineKeys } from "@/features/quarantine/keys";

import { useRejectQuarantinedAsset, useReleaseQuarantinedAsset } from "./useQuarantineMutations";

// The quarantine release/reject routes are publicId-keyed
// (`POST /v1/quarantine/:publicId/release`), but the response body is the
// full AssetResponseDTO, which carries the internal id too. The asset-detail
// cache (`assetsKeys.detail`) is keyed by the internal id.
const ASSET_PUBLIC_ID = "abcdef12-3456-7890-abcd-ef1234567890";
const ASSET_INTERNAL_ID = "01977b7a-6e6d-7000-8000-000000000002";

function assetResponse(overrides: Partial<AssetResponseDTO> = {}): AssetResponseDTO {
  return {
    id: ASSET_INTERNAL_ID,
    publicId: ASSET_PUBLIC_ID,
    namespaceSlug: "aircraft-photos",
    policyVersion: 1,
    state: "ready",
    customMetadata: {},
    tags: [],
    legalHold: false,
    stateChangedAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const mockQuarantine = {
  release: vi.fn(),
  reject: vi.fn(),
};

vi.mock("@lafken/react", () => ({
  useLafkenClient: () => ({ quarantine: mockQuarantine }),
}));

function createWrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("useQuarantineMutations cache fan-out", () => {
  let queryClient: QueryClient;
  let invalidateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("release invalidates quarantine lists, asset detail by internal id, asset lists, dashboard, and audit lists", async () => {
    mockQuarantine.release.mockResolvedValue(assetResponse());
    const { result } = renderHook(() => useReleaseQuarantinedAsset(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({
        publicId: ASSET_PUBLIC_ID,
        note: "Reviewed, false positive.",
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockQuarantine.release).toHaveBeenCalledWith(ASSET_PUBLIC_ID, {
      note: "Reviewed, false positive.",
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: quarantineKeys.lists() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: assetsKeys.lists() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: dashboardKeys.all });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: auditKeys.lists() });

    // Pins the identifier bug: the asset-detail cache is keyed by the
    // internal id (from the mutation response), never the publicId.
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: assetsKeys.detail(ASSET_INTERNAL_ID),
    });
    expect(invalidateSpy).not.toHaveBeenCalledWith({
      queryKey: assetsKeys.detail(ASSET_PUBLIC_ID),
    });
  });

  it("reject invalidates quarantine lists, asset detail by internal id, asset lists, dashboard, and audit lists", async () => {
    mockQuarantine.reject.mockResolvedValue(assetResponse({ state: "rejected" }));
    const { result } = renderHook(() => useRejectQuarantinedAsset(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({
        publicId: ASSET_PUBLIC_ID,
        note: "Reviewed, false positive.",
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockQuarantine.reject).toHaveBeenCalledWith(ASSET_PUBLIC_ID, {
      note: "Reviewed, false positive.",
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: quarantineKeys.lists() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: assetsKeys.lists() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: dashboardKeys.all });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: auditKeys.lists() });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: assetsKeys.detail(ASSET_INTERNAL_ID),
    });
    expect(invalidateSpy).not.toHaveBeenCalledWith({
      queryKey: assetsKeys.detail(ASSET_PUBLIC_ID),
    });
  });
});
