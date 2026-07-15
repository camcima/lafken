import type { ListAssetsQueryDTO } from "@shared/backend-api";

export const assetsKeys = {
  all: ["assets"] as const,
  lists: () => [...assetsKeys.all, "list"] as const,
  list: (q: Partial<ListAssetsQueryDTO>) => [...assetsKeys.lists(), q] as const,
  details: () => [...assetsKeys.all, "detail"] as const,
  // NOTE: keyed by the internal admin id (uuidv7), NOT the external publicId
  // (uuidv4). `useAsset`/the `/assets/$id` route use the internal id — see
  // AssetResponseDTO.id vs .publicId. Passing a publicId here silently
  // matches nothing.
  detail: (id: string) => [...assetsKeys.details(), id] as const,
  stateTransitions: (id: string) => [...assetsKeys.detail(id), "state-transitions"] as const,
  analyses: (id: string) => [...assetsKeys.detail(id), "analyses"] as const,
  processingJob: (id: string) => [...assetsKeys.detail(id), "processing-job"] as const,
};
