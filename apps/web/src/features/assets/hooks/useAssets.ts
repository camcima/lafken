import { useLafkenClient } from "@lafken/react";
import type { ListAssetsQueryDTO } from "@shared/backend-api";
import { useQuery } from "@tanstack/react-query";

import { assetsKeys } from "@/features/assets/keys";

export function useAssets(q: Partial<ListAssetsQueryDTO> = {}) {
  const client = useLafkenClient();
  return useQuery({
    queryKey: assetsKeys.list(q),
    queryFn: () => client.assets.list(q),
  });
}

export function useAsset(id: string) {
  const client = useLafkenClient();
  return useQuery({
    queryKey: assetsKeys.detail(id),
    queryFn: () => client.assets.get(id),
    enabled: Boolean(id),
  });
}

export function useAssetStateTransitions(id: string) {
  const client = useLafkenClient();
  return useQuery({
    queryKey: assetsKeys.stateTransitions(id),
    queryFn: () => client.assets.listStateTransitions(id),
    enabled: Boolean(id),
  });
}

export function useAssetAnalyses(id: string) {
  const client = useLafkenClient();
  return useQuery({
    queryKey: assetsKeys.analyses(id),
    queryFn: () => client.assets.listAnalyses(id),
    enabled: Boolean(id),
  });
}

export function useAssetProcessingJob(id: string) {
  const client = useLafkenClient();
  return useQuery({
    queryKey: assetsKeys.processingJob(id),
    queryFn: () => client.assets.getProcessingJob(id),
    enabled: Boolean(id),
  });
}
