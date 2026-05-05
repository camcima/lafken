import { createFileRoute } from "@tanstack/react-router";

import { EditPolicyPage } from "@/features/namespaces/components/EditPolicyPage";

export const Route = createFileRoute("/_protected/namespaces/$slug_/policy/edit")({
  component: EditPolicyPage,
});
