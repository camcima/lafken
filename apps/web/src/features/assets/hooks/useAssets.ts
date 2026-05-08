import type { ListAssetsQueryDTO } from "@shared/backend-api";
import { useQuery } from "@tanstack/react-query";

import { assetsKeys } from "@/features/assets/keys";
import { assetsService } from "@/services";

export function useAssets(q: Partial<ListAssetsQueryDTO> = {}) {
  return useQuery({
    queryKey: assetsKeys.list(q),
    queryFn: () => assetsService.list(q),
  });
}

export function useAsset(id: string) {
  return useQuery({
    queryKey: assetsKeys.detail(id),
    queryFn: () => assetsService.getById(id),
    enabled: Boolean(id),
  });
}

export function useAssetStateTransitions(id: string) {
  return useQuery({
    queryKey: assetsKeys.stateTransitions(id),
    queryFn: () => assetsService.listStateTransitions(id),
    enabled: Boolean(id),
  });
}

export function useAssetAnalyses(id: string) {
  return useQuery({
    queryKey: assetsKeys.analyses(id),
    queryFn: () => assetsService.listAnalyses(id),
    enabled: Boolean(id),
  });
}

export function useAssetProcessingJob(id: string) {
  return useQuery({
    queryKey: assetsKeys.processingJob(id),
    queryFn: () => assetsService.getProcessingJob(id),
    enabled: Boolean(id),
  });
}
