import { useLafkenClient } from "@lafken/react";
import type { LegalHoldResponseDTO } from "@shared/backend-api";
import { type QueryClient, useMutation, useQueryClient } from "@tanstack/react-query";

import { assetsKeys } from "@/features/assets/keys";
import { auditKeys } from "@/features/audit/keys";
import { dashboardKeys } from "@/features/dashboard/keys";
import { legalHoldsKeys } from "@/features/legal-holds/keys";

interface IPlaceInput {
  caseReference: string;
  description: string;
  /** External publicIds (uuidv4) — this is what `PlaceLegalHoldRequestDTO` and the backend resolve scope by. */
  assetIds: string[];
  /**
   * Internal ids (uuidv7) of the same assets, in the same selection, used
   * only client-side to invalidate `assetsKeys.detail` (which is keyed by
   * the internal id, not the publicId). Never sent to the API.
   */
  assetInternalIds: string[];
}

interface ILiftInput {
  id: string;
  liftReason: string;
}

/**
 * Cache fan-out after a place: refresh the holds list, the asset list (banner
 * state may have changed), each affected asset's detail (banner), the
 * dashboard overview (sidebar count badges), and the audit trail.
 *
 * `affectedInternalIds` must be internal ids (uuidv7) — `assetsKeys.detail`
 * is keyed by the internal id, not the publicId the place request carries.
 */
function invalidateAfterPlace(queryClient: QueryClient, affectedInternalIds: string[]): void {
  void queryClient.invalidateQueries({ queryKey: legalHoldsKeys.lists() });
  void queryClient.invalidateQueries({ queryKey: assetsKeys.lists() });
  for (const id of affectedInternalIds) {
    void queryClient.invalidateQueries({ queryKey: assetsKeys.detail(id) });
  }
  void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
  void queryClient.invalidateQueries({ queryKey: auditKeys.lists() });
}

/**
 * Cache fan-out after a lift. The lift response does not list every covered
 * asset's id, so invalidate ALL asset details — a lifted hold must not keep
 * showing as active on any open detail page (F-W3) — plus the holds list,
 * this hold's detail, the asset list, the dashboard overview, and audit.
 */
function invalidateAfterLift(queryClient: QueryClient, holdId: string): void {
  void queryClient.invalidateQueries({ queryKey: legalHoldsKeys.lists() });
  void queryClient.invalidateQueries({ queryKey: legalHoldsKeys.detail(holdId) });
  void queryClient.invalidateQueries({ queryKey: assetsKeys.lists() });
  void queryClient.invalidateQueries({ queryKey: assetsKeys.details() });
  void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
  void queryClient.invalidateQueries({ queryKey: auditKeys.lists() });
}

export function usePlaceLegalHold() {
  const client = useLafkenClient();
  const queryClient = useQueryClient();
  return useMutation<LegalHoldResponseDTO, Error, IPlaceInput>({
    // The backend's ValidationPipe uses forbidNonWhitelisted, so the body
    // must carry exactly the DTO's fields — assetInternalIds is client-only
    // and must not be forwarded.
    mutationFn: (input) =>
      client.legalHolds.place({
        caseReference: input.caseReference,
        description: input.description,
        assetIds: input.assetIds,
      }),
    onSuccess: (_data, input) => {
      invalidateAfterPlace(queryClient, input.assetInternalIds);
    },
  });
}

export function useLiftLegalHold() {
  const client = useLafkenClient();
  const queryClient = useQueryClient();
  return useMutation<LegalHoldResponseDTO, Error, ILiftInput>({
    mutationFn: ({ id, liftReason }) => client.legalHolds.lift(id, { liftReason }),
    onSuccess: (_data, { id }) => {
      invalidateAfterLift(queryClient, id);
    },
  });
}
