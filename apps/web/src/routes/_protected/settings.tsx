import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { SettingsPage } from "@/features/settings/components/SettingsPage";

const SETTINGS_TABS = ["workspace", "members", "api", "policies", "danger"] as const;

export const settingsSearchSchema = z.object({
  tab: z.enum(SETTINGS_TABS).optional().default("workspace"),
});

export const Route = createFileRoute("/_protected/settings")({
  validateSearch: settingsSearchSchema,
  component: SettingsPage,
});
