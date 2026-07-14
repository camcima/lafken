import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { QuarantinePage } from "@/features/quarantine/components/QuarantinePage";

const QUARANTINE_KIND_FILTERS = ["all", "moderation", "virus", "invalid_format"] as const;

// `.default("all")` keeps `kind` optional at every `navigate`/`Link` call
// site; a malformed/unknown value (hand-edited URL) degrades to the "all"
// tab instead of throwing inside `validateSearch` and crashing the route.
export const quarantineSearchSchema = z.object({
  kind: z.enum(QUARANTINE_KIND_FILTERS).catch("all").default("all"),
});

export const Route = createFileRoute("/_protected/quarantine")({
  validateSearch: quarantineSearchSchema,
  component: QuarantinePage,
});
