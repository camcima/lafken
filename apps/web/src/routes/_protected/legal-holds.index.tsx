import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { LegalHoldsListPage } from "@/features/legal-holds/components/LegalHoldsListPage";

const searchSchema = z.object({
  q: z.string().optional(),
});

export const Route = createFileRoute("/_protected/legal-holds/")({
  component: LegalHoldsListPage,
  validateSearch: searchSchema,
});
