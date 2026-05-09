import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";

import { NamespaceDetailPage } from "@/features/namespaces/components/NamespaceDetailPage";

const NAMESPACE_TABS = ["overview", "policy", "presets"] as const;

const searchSchema = z.object({
  tab: z.enum(NAMESPACE_TABS).optional().default("overview"),
});

function NamespaceDetailRouteWrapper() {
  const { slug } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();

  return (
    <NamespaceDetailPage
      slug={slug}
      tab={search.tab}
      onTabChange={(newTab) => {
        void navigate({ to: ".", search: { tab: newTab } });
      }}
    />
  );
}

export const Route = createFileRoute("/_protected/namespaces/$slug")({
  validateSearch: searchSchema,
  component: NamespaceDetailRouteWrapper,
});
