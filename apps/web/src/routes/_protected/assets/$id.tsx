import { createFileRoute } from "@tanstack/react-router";

import { AssetDetailPage } from "@/features/assets/components/AssetDetailPage";

function AssetDetailRouteWrapper() {
  const { id } = Route.useParams();
  return <AssetDetailPage id={id} />;
}

export const Route = createFileRoute("/_protected/assets/$id")({
  component: AssetDetailRouteWrapper,
});
