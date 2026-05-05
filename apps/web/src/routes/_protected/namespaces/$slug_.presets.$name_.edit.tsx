import { createFileRoute } from "@tanstack/react-router";

import { EditPresetPage } from "@/features/namespaces/components/EditPresetPage";

export const Route = createFileRoute("/_protected/namespaces/$slug_/presets/$name_/edit")({
  component: EditPresetPage,
});
