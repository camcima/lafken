import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { LegalHoldsListPage } from "@/features/legal-holds/components/LegalHoldsListPage";

const HOLD_STATUS_FILTERS = ["all", "active", "lifted"] as const;

// `.catch()` makes each param degrade to its fallback instead of throwing —
// the URL is user-editable, so a hand-edited/stale/truncated URL is expected
// input, not a crash. `status` and `page` fall back to their defaults
// whether the param is missing (`.default`) or malformed, e.g. `page=abc` or
// `status=bogus` (`.catch`). `.default()` stays outermost so both remain
// optional in `navigate`/`Link` `search` calls — TanStack Router infers
// search-param optionality from it at the type level, so dropping it would
// break type-check at every call site.
export const legalHoldsSearchSchema = z.object({
  q: z.string().optional().catch(undefined),
  status: z.enum(HOLD_STATUS_FILTERS).catch("all").default("all"),
  page: z.coerce.number().int().min(1).catch(1).default(1),
});

export const Route = createFileRoute("/_protected/legal-holds/")({
  component: LegalHoldsListPage,
  validateSearch: legalHoldsSearchSchema,
});
