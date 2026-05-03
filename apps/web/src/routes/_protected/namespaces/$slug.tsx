import { createFileRoute } from "@tanstack/react-router";

import { NamespaceDetailPage } from "@/features/namespaces/components/NamespaceDetailPage";

function NamespaceDetailRouteWrapper() {
  const { slug } = Route.useParams();
  return <NamespaceDetailPage slug={slug} />;
}

export const Route = createFileRoute("/_protected/namespaces/$slug")({
  component: NamespaceDetailRouteWrapper,
});
