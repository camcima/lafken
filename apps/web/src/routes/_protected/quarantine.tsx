import { createFileRoute } from "@tanstack/react-router";

import { QuarantinePage } from "@/features/quarantine/components/QuarantinePage";

export const Route = createFileRoute("/_protected/quarantine")({
  component: QuarantinePage,
});
