import { useNavigate, useSearch } from "@tanstack/react-router";
import { Settings2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/common/Card";
import { EmptyState } from "@/components/common/EmptyState";
import { Tabs } from "@/components/common/Tabs";
import type { ITab } from "@/components/common/Tabs";

type ISettingsTab = "workspace" | "members" | "api" | "policies" | "danger";

export function SettingsPage(): React.JSX.Element {
  const { t } = useTranslation();
  const { tab } = useSearch({ from: "/_protected/settings" });
  const navigate = useNavigate({ from: "/settings" });
  const setTab = (next: ISettingsTab): void => {
    void navigate({ search: { tab: next } });
  };

  const tabs: ITab<ISettingsTab>[] = [
    { id: "workspace", label: t("pages.settings.tabs.workspace") },
    { id: "members", label: t("pages.settings.tabs.members") },
    { id: "api", label: t("pages.settings.tabs.api") },
    { id: "policies", label: t("pages.settings.tabs.policies") },
    { id: "danger", label: t("pages.settings.tabs.danger") },
  ];

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h1 className="m-0 text-[22px] font-bold tracking-tight">{t("pages.settings.title")}</h1>
        <div className="text-muted-foreground mt-1 text-[12.5px]">
          {t("pages.settings.subtitle")}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} items={tabs} />

      {/* No settings API exists yet — every tab is honestly "not configured"
          instead of the previous hardcoded demo data (F-W5). */}
      <Card>
        <EmptyState
          icon={Settings2}
          title={t("pages.settings.notConfigured.title")}
          description={t("pages.settings.notConfigured.description")}
        />
      </Card>
    </div>
  );
}
