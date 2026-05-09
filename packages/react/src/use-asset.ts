import type { AssetsClient } from "@lafken/client";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useContext } from "react";

import { _LafkenClientContext } from "./lafken-provider";

/** The type returned by `client.assets.get(publicId)`. */
type AssetDTO = Awaited<ReturnType<AssetsClient["get"]>>;

const DEFAULT_STALE_TIME_MS = 5_000;

export function useAsset(
  publicId: string,
  options: { staleTime?: number } = {},
): UseQueryResult<AssetDTO, Error> {
  const client = useContext(_LafkenClientContext);
  if (client === null) throw new Error("useAsset requires a <LafkenProvider> ancestor");
  return useQuery<AssetDTO, Error>({
    queryKey: ["lafken", "asset", publicId],
    queryFn: () => client.assets.get(publicId),
    enabled: Boolean(publicId),
    staleTime: options.staleTime ?? DEFAULT_STALE_TIME_MS,
  });
}
