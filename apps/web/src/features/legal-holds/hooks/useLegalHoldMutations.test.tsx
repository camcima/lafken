import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { assetsKeys } from "@/features/assets/keys";
import { auditKeys } from "@/features/audit/keys";
import { dashboardKeys } from "@/features/dashboard/keys";
import { legalHoldsKeys } from "@/features/legal-holds/keys";

import { useLiftLegalHold, usePlaceLegalHold } from "./useLegalHoldMutations";

// The asset's external publicId (uuidv4) is what `assetIds` in the place
// request must carry (it's what the backend resolves against). The internal
// id (uuidv7) is what the asset-detail cache (`assetsKeys.detail`) is keyed
// by. They must never be swapped.
const ASSET_PUBLIC_ID = "abcdef12-3456-7890-abcd-ef1234567890";
const ASSET_INTERNAL_ID = "01977b7a-6e6d-7000-8000-000000000001";

const mockLegalHolds = {
  place: vi.fn(),
  lift: vi.fn(),
};

vi.mock("@lafken/react", () => ({
  useLafkenClient: () => ({ legalHolds: mockLegalHolds }),
}));

function createWrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("useLegalHoldMutations cache fan-out", () => {
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

  it("place sends only publicIds to the API but invalidates asset detail by internal id, plus holds, asset lists, dashboard, and audit lists", async () => {
    mockLegalHolds.place.mockResolvedValue({ id: "h1" });
    const { result } = renderHook(() => usePlaceLegalHold(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({
        caseReference: "CHL-1",
        description: "Ten characters.",
        assetIds: [ASSET_PUBLIC_ID],
        assetInternalIds: [ASSET_INTERNAL_ID],
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // The wire payload must carry publicIds only — the backend resolves
    // legal-hold scope by publicId and rejects unknown request properties.
    expect(mockLegalHolds.place).toHaveBeenCalledWith({
      caseReference: "CHL-1",
      description: "Ten characters.",
      assetIds: [ASSET_PUBLIC_ID],
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: legalHoldsKeys.lists() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: assetsKeys.lists() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: dashboardKeys.all });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: auditKeys.lists() });

    // Pins the identifier bug: the asset-detail cache is keyed by the
    // internal id, never the publicId.
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: assetsKeys.detail(ASSET_INTERNAL_ID),
    });
    expect(invalidateSpy).not.toHaveBeenCalledWith({
      queryKey: assetsKeys.detail(ASSET_PUBLIC_ID),
    });
  });

  it("lift invalidates all asset details (banner refresh), holds, asset lists, dashboard, and audit lists", async () => {
    mockLegalHolds.lift.mockResolvedValue({ id: "h1" });
    const { result } = renderHook(() => useLiftLegalHold(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({ id: "h1", liftReason: "Case closed." });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: legalHoldsKeys.lists() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: legalHoldsKeys.detail("h1") });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: assetsKeys.lists() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: assetsKeys.details() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: dashboardKeys.all });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: auditKeys.lists() });
  });
});
