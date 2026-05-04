import { createFileRoute } from "@tanstack/react-router";

import { NewNamespacePage } from "@/features/namespaces/components/NewNamespacePage";

export const Route = createFileRoute("/_protected/namespaces/new")({
  component: NewNamespacePage,
});
