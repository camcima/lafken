import { createFileRoute } from "@tanstack/react-router";

import { NewPresetPage } from "@/features/namespaces/components/NewPresetPage";

export const Route = createFileRoute("/_protected/namespaces/$slug_/presets/new")({
  component: NewPresetPage,
});
