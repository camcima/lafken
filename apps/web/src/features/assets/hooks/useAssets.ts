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

export function useAsset(publicId: string) {
  return useQuery({
    queryKey: assetsKeys.detail(publicId),
    queryFn: () => assetsService.getByPublicId(publicId),
    enabled: Boolean(publicId),
  });
}

export function useAssetStateTransitions(publicId: string) {
  return useQuery({
    queryKey: assetsKeys.stateTransitions(publicId),
    queryFn: () => assetsService.listStateTransitions(publicId),
    enabled: Boolean(publicId),
  });
}

export function useAssetAnalyses(publicId: string) {
  return useQuery({
    queryKey: assetsKeys.analyses(publicId),
    queryFn: () => assetsService.listAnalyses(publicId),
    enabled: Boolean(publicId),
  });
}

export function useAssetProcessingJob(publicId: string) {
  return useQuery({
    queryKey: assetsKeys.processingJob(publicId),
    queryFn: () => assetsService.getProcessingJob(publicId),
    enabled: Boolean(publicId),
  });
}
