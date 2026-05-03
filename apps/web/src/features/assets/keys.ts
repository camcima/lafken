import type { ListAssetsQueryDTO } from "@shared/backend-api";

export const assetsKeys = {
  all: ["assets"] as const,
  lists: () => [...assetsKeys.all, "list"] as const,
  list: (q: Partial<ListAssetsQueryDTO>) => [...assetsKeys.lists(), q] as const,
  details: () => [...assetsKeys.all, "detail"] as const,
  detail: (publicId: string) => [...assetsKeys.details(), publicId] as const,
  stateTransitions: (publicId: string) =>
    [...assetsKeys.detail(publicId), "state-transitions"] as const,
  analyses: (publicId: string) => [...assetsKeys.detail(publicId), "analyses"] as const,
  processingJob: (publicId: string) => [...assetsKeys.detail(publicId), "processing-job"] as const,
};
