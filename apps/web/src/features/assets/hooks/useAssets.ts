import type { ListAssetsQueryDTO } from "@shared/backend-api";
import { useQuery } from "@tanstack/react-query";
import { useLafkenClient } from "@lafken/react";

import { assetsKeys } from "@/features/assets/keys";

export function useAssets(q: Partial<ListAssetsQueryDTO> = {}) {
  const c = useLafkenClient();
  return useQuery({
    queryKey: assetsKeys.list(q),
    queryFn: () => c.assets.list(q),
  });
}

export function useAsset(id: string) {
  const c = useLafkenClient();
  return useQuery({
    queryKey: assetsKeys.detail(id),
    queryFn: () => c.assets.get(id),
    enabled: Boolean(id),
  });
}

export function useAssetStateTransitions(id: string) {
  const c = useLafkenClient();
  return useQuery({
    queryKey: assetsKeys.stateTransitions(id),
    queryFn: () => c.assets.listStateTransitions(id),
    enabled: Boolean(id),
  });
}

export function useAssetAnalyses(id: string) {
  const c = useLafkenClient();
  return useQuery({
    queryKey: assetsKeys.analyses(id),
    queryFn: () => c.assets.listAnalyses(id),
    enabled: Boolean(id),
  });
}

export function useAssetProcessingJob(id: string) {
  const c = useLafkenClient();
  return useQuery({
    queryKey: assetsKeys.processingJob(id),
    queryFn: () => c.assets.getProcessingJob(id),
    enabled: Boolean(id),
  });
}
