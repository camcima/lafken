import { useLafkenClient } from "@lafken/react";
import { type QueryClient, useMutation, useQueryClient } from "@tanstack/react-query";

import { assetsKeys } from "@/features/assets/keys";
import { dashboardKeys } from "@/features/dashboard/keys";

interface IDeleteAssetInput {
  /** Internal asset id (uuidv7) — the identifier admin routes use. */
  id: string;
}

/**
 * Cache fan-out after a delete, mirroring useQuarantineMutations: the detail
 * page (state flips to `deleted`; the detail key also prefixes the timeline
 * and processing-job keys), the assets list, and the dashboard counts (which
 * feed the sidebar badges) all change.
 */
function invalidateAfterDelete(queryClient: QueryClient, id: string): void {
  void queryClient.invalidateQueries({ queryKey: assetsKeys.detail(id) });
  void queryClient.invalidateQueries({ queryKey: assetsKeys.lists() });
  void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
}

/**
 * Soft-deletes an asset. Server-side role-gated (`lafken_asset_deleter`);
 * a caller without the role receives a 403 surfaced as the mutation error.
 */
export function useDeleteAsset() {
  const client = useLafkenClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: IDeleteAssetInput) => client.assets.delete(id),
    onSuccess: (_data, { id }) => {
      invalidateAfterDelete(queryClient, id);
    },
  });
}
