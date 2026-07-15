import { useLafkenClient } from "@lafken/react";
import type { AssetResponseDTO } from "@shared/backend-api";
import { type QueryClient, useMutation, useQueryClient } from "@tanstack/react-query";

import { assetsKeys } from "@/features/assets/keys";
import { auditKeys } from "@/features/audit/keys";
import { dashboardKeys } from "@/features/dashboard/keys";
import { quarantineKeys } from "@/features/quarantine/keys";

interface IReleaseInput {
  publicId: string;
  note?: string;
}

interface IRejectInput {
  publicId: string;
  note: string;
}

/**
 * Cache fan-out for any quarantine review action. The queue page, the asset
 * detail page (state may have changed), the assets list, the dashboard
 * overview (which feeds the sidebar count badge), and the audit trail all
 * need to refetch.
 *
 * `id` must be the asset's *internal* id (uuidv7) — `assetsKeys.detail` is
 * keyed by it, not by the publicId the quarantine routes take. The release/
 * reject response is the full `AssetResponseDTO`, so callers pass
 * `data.id`, not the `publicId` used to make the request.
 */
function invalidateAfterReview(queryClient: QueryClient, id: string): void {
  void queryClient.invalidateQueries({ queryKey: quarantineKeys.lists() });
  void queryClient.invalidateQueries({ queryKey: assetsKeys.detail(id) });
  void queryClient.invalidateQueries({ queryKey: assetsKeys.lists() });
  void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
  void queryClient.invalidateQueries({ queryKey: auditKeys.lists() });
}

/**
 * Releases a quarantined asset back to the `ready` state.
 */
export function useReleaseQuarantinedAsset() {
  const client = useLafkenClient();
  const queryClient = useQueryClient();
  return useMutation<AssetResponseDTO, Error, IReleaseInput>({
    mutationFn: ({ publicId, note }) => client.quarantine.release(publicId, { note }),
    onSuccess: (data) => {
      invalidateAfterReview(queryClient, data.id);
    },
  });
}

/**
 * Rejects a quarantined asset terminally. Caller is responsible for
 * collecting the reviewer note (the BE requires a minimum of 12 characters).
 */
export function useRejectQuarantinedAsset() {
  const client = useLafkenClient();
  const queryClient = useQueryClient();
  return useMutation<AssetResponseDTO, Error, IRejectInput>({
    mutationFn: ({ publicId, note }) => client.quarantine.reject(publicId, { note }),
    onSuccess: (data) => {
      invalidateAfterReview(queryClient, data.id);
    },
  });
}
