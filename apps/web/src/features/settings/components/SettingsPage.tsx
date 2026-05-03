import React from "react";
import { useTranslation } from "react-i18next";

import { EmptyState } from "@/components/common/EmptyState";
import { useUserPreferencesStore } from "@/hooks/useUserPreferences";

export function SettingsPage(): React.JSX.Element {
  const { t } = useTranslation();
  const { userPreferences } = useUserPreferencesStore();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[22px] font-bold tracking-tight text-neutral-900">
          {t("pages.settings.title")}
        </h1>
      </header>

      {/* Coming soon banner */}
      <EmptyState title={t("pages.settings.title")} description={t("pages.settings.comingSoon")} />

      {/* Preview of the future form — all inputs disabled */}
      <section className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-neutral-600">
              {t("pages.settings.labels.theme")}
            </label>
            <select
              disabled
              value={userPreferences.theme}
              className="w-full max-w-xs rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-400"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-neutral-600">
              {t("pages.settings.labels.language")}
            </label>
            <select
              disabled
              value={userPreferences.language}
              className="w-full max-w-xs rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-400"
            >
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="pt">Português</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-neutral-600">
              {t("pages.settings.labels.dateFormat")}
            </label>
            <select
              disabled
              value={userPreferences.dateFormat}
              className="w-full max-w-xs rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-400"
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            </select>
          </div>
        </div>
      </section>
    </div>
  );
}
