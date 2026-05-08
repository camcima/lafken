import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { UploadAssetsPage } from "@/features/assets/components/UploadAssetsPage";

const uploadSearchSchema = z.object({
  ns: z.string().optional(),
});

export const Route = createFileRoute("/_protected/assets/upload")({
  validateSearch: uploadSearchSchema,
  component: UploadAssetsRoute,
});

function UploadAssetsRoute(): React.JSX.Element {
  const { ns } = Route.useSearch();
  return <UploadAssetsPage preselectedSlug={ns} />;
}
