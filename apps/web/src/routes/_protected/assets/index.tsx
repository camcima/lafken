import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { AssetsListPage } from "@/features/assets/components/AssetsListPage";

const assetsSearchSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  namespaceSlug: z.string().optional(),
  state: z
    .enum([
      "pending",
      "uploaded",
      "processing",
      "ready",
      "rejected",
      "quarantined_virus",
      "quarantined_moderation",
      "processing_failed",
      "expired",
      "deleted",
    ])
    .optional(),
});

export const Route = createFileRoute("/_protected/assets/")({
  validateSearch: assetsSearchSchema,
  component: AssetsListPage,
});
