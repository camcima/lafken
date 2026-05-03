import { createFileRoute } from "@tanstack/react-router";

import { SystemPage } from "@/features/system/components/SystemPage";

export const Route = createFileRoute("/_protected/system")({
  component: SystemPage,
});
