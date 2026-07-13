import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { ASSET_STATES } from "@/features/assets/asset-states";
import { AssetsListPage } from "@/features/assets/components/AssetsListPage";

export const assetsSearchSchema = z.object({
  // `.catch()` makes each param degrade to its fallback instead of throwing —
  // the URL is the source of truth here, so hand-edited/stale/truncated URLs
  // are expected input, not a crash. `page` falls back to 1 whether it is
  // missing (`.default`) or malformed, e.g. "abc" (`.catch`); an unknown
  // `state` falls back to "no filter" (undefined). `.default()` stays
  // outermost so `page` remains optional in `navigate`/`Link` `search` calls.
  page: z.coerce.number().int().min(1).catch(1).default(1),
  namespaceSlug: z.string().optional(),
  state: z.enum(ASSET_STATES).optional().catch(undefined),
  legalHoldId: z.uuid().optional().catch(undefined),
});

export const Route = createFileRoute("/_protected/assets/")({
  validateSearch: assetsSearchSchema,
  component: AssetsListPage,
});
