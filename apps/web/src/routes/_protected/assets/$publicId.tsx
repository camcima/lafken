import { createFileRoute } from "@tanstack/react-router";

import { AssetDetailPage } from "@/features/assets/components/AssetDetailPage";

function AssetDetailRouteWrapper() {
  const { publicId } = Route.useParams();
  return <AssetDetailPage publicId={publicId} />;
}

export const Route = createFileRoute("/_protected/assets/$publicId")({
  component: AssetDetailRouteWrapper,
});
