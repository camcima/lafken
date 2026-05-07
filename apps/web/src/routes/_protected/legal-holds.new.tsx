import { createFileRoute } from "@tanstack/react-router";

import { PlaceLegalHoldPage } from "@/features/legal-holds/components/PlaceLegalHoldPage";

export const Route = createFileRoute("/_protected/legal-holds/new")({
  component: PlaceLegalHoldPage,
});
