import type { LegalHoldResponseDTO } from "@shared/backend-api";
import { type QueryClient, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLafkenClient } from "@lafken/react";

import { assetsKeys } from "@/features/assets/keys";
import { dashboardKeys } from "@/features/dashboard/keys";
import { legalHoldsKeys } from "@/features/legal-holds/keys";

interface IPlaceInput {
  caseReference: string;
  description: string;
  assetIds: string[];
}

interface ILiftInput {
  id: string;
  liftReason: string;
}

/**
 * Cache fan-out after a place: refresh the holds list, the asset list (banner
 * state may have changed), each affected asset's detail (banner), and the
 * dashboard overview (sidebar count badges).
 */
function invalidateAfterPlace(queryClient: QueryClient, affectedPublicIds: string[]): void {
  void queryClient.invalidateQueries({ queryKey: legalHoldsKeys.lists() });
  void queryClient.invalidateQueries({ queryKey: assetsKeys.lists() });
  for (const publicId of affectedPublicIds) {
    void queryClient.invalidateQueries({ queryKey: assetsKeys.detail(publicId) });
  }
  void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
}

/**
 * Cache fan-out after a lift. The lift response does not list every covered
 * asset's publicId, so we rely on per-asset staleTime for detail-page refreshes.
 */
function invalidateAfterLift(queryClient: QueryClient, holdId: string): void {
  void queryClient.invalidateQueries({ queryKey: legalHoldsKeys.lists() });
  void queryClient.invalidateQueries({ queryKey: legalHoldsKeys.detail(holdId) });
  void queryClient.invalidateQueries({ queryKey: assetsKeys.lists() });
  void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
}

export function usePlaceLegalHold() {
  const c = useLafkenClient();
  const queryClient = useQueryClient();
  return useMutation<LegalHoldResponseDTO, Error, IPlaceInput>({
    mutationFn: (input) => c.legalHolds.place(input),
    onSuccess: (_data, input) => {
      invalidateAfterPlace(queryClient, input.assetIds);
    },
  });
}

export function useLiftLegalHold() {
  const c = useLafkenClient();
  const queryClient = useQueryClient();
  return useMutation<LegalHoldResponseDTO, Error, ILiftInput>({
    mutationFn: ({ id, liftReason }) => c.legalHolds.lift(id, { liftReason }),
    onSuccess: (_data, { id }) => {
      invalidateAfterLift(queryClient, id);
    },
  });
}
