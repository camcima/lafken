import { createFileRoute } from "@tanstack/react-router";

import { LegalHoldsListPage } from "@/features/legal-holds/components/LegalHoldsListPage";

export const Route = createFileRoute("/_protected/legal-holds")({
  component: LegalHoldsListPage,
});
