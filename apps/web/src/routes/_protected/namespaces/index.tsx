import { createFileRoute } from "@tanstack/react-router";

import { NamespacesListPage } from "@/features/namespaces/components/NamespacesListPage";

export const Route = createFileRoute("/_protected/namespaces/")({
  component: NamespacesListPage,
});
