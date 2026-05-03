import { createFileRoute } from "@tanstack/react-router";

import { HomePage } from "@/features/dashboard/components/HomePage";

export const Route = createFileRoute("/_protected/")({
  component: HomePage,
});
