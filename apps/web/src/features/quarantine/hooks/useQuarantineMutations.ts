import { useLafkenClient } from "@lafken/react";
import type { AssetResponseDTO } from "@shared/backend-api";
import { type QueryClient, useMutation, useQueryClient } from "@tanstack/react-query";

import { assetsKeys } from "@/features/assets/keys";
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
 * detail page (state may have changed), the assets list, and the dashboard
 * overview (which feeds the sidebar count badge) all need to refetch.
 */
function invalidateAfterReview(queryClient: QueryClient, publicId: string): void {
  void queryClient.invalidateQueries({ queryKey: quarantineKeys.lists() });
  void queryClient.invalidateQueries({ queryKey: assetsKeys.detail(publicId) });
  void queryClient.invalidateQueries({ queryKey: assetsKeys.lists() });
  void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
}

/**
 * Releases a quarantined asset back to the `ready` state.
 */
export function useReleaseQuarantinedAsset() {
  const client = useLafkenClient();
  const queryClient = useQueryClient();
  return useMutation<AssetResponseDTO, Error, IReleaseInput>({
    mutationFn: ({ publicId, note }) => client.quarantine.release(publicId, { note }),
    onSuccess: (_data, { publicId }) => {
      invalidateAfterReview(queryClient, publicId);
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
    onSuccess: (_data, { publicId }) => {
      invalidateAfterReview(queryClient, publicId);
    },
  });
}
