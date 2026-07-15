import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { AuditPage } from "@/features/audit/components/AuditPage";

export const AUDIT_ENTITY_TYPES = [
  "asset",
  "namespace",
  "namespace_policy",
  "namespace_preset",
  "storage_binding",
  "legal_hold",
] as const;

// `.catch()` makes each param degrade to its fallback instead of throwing —
// the URL is user-editable, so a hand-edited/stale/truncated URL is expected
// input, not a crash. `page` falls back to 1 whether it is missing
// (`.default`) or malformed, e.g. "abc" (`.catch`); an unknown `type` or a
// malformed `q` fall back to "no filter" (undefined). `.default()` stays
// outermost so `page` remains optional in `navigate`/`Link` `search` calls.
export const auditSearchSchema = z.object({
  q: z.string().optional().catch(undefined),
  type: z.enum(AUDIT_ENTITY_TYPES).optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1).default(1),
});

export const Route = createFileRoute("/_protected/audit")({
  validateSearch: auditSearchSchema,
  component: AuditPage,
});
