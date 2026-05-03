import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { ASSET_STATES } from "@/features/assets/asset-states";
import { AssetsListPage } from "@/features/assets/components/AssetsListPage";

const assetsSearchSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  namespaceSlug: z.string().optional(),
  state: z.enum(ASSET_STATES).optional(),
});

export const Route = createFileRoute("/_protected/assets/")({
  validateSearch: assetsSearchSchema,
  component: AssetsListPage,
});
