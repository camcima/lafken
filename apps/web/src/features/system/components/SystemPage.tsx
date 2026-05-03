import React from "react";
import { useTranslation } from "react-i18next";

import { EmptyState } from "@/components/common/EmptyState";
import { IntegrationRow } from "@/features/system/components/IntegrationRow";
import {
  useIntegrations,
  useStorageBindings,
  useSystemHealth,
} from "@/features/system/hooks/useSystem";

export function SystemPage(): React.JSX.Element {
  const { t } = useTranslation();
  const { data: storageBindings } = useStorageBindings();
  const { data: integrations } = useIntegrations();
  const { data: health } = useSystemHealth();

  const bindings = storageBindings ?? [];
  const integrationList = integrations ?? [];
  const indicators = health?.indicators ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[22px] font-bold tracking-tight text-neutral-900">
          {t("pages.system.title")}
        </h1>
      </header>

      {/* Storage bindings */}
      <section className="rounded-lg border border-neutral-200 bg-white shadow-sm">
        <header className="border-b border-neutral-200 px-5 py-3">
          <h2 className="text-sm font-medium text-neutral-900">
            {t("pages.system.storageBindings")}
          </h2>
        </header>
        {bindings.length === 0 ? (
          <EmptyState title={t("pages.system.noStorageBindings")} className="py-8" />
        ) : (
          <ul className="divide-y divide-neutral-100">
            {bindings.map((b) => (
              <li key={b.name} className="px-5 py-3 text-sm text-neutral-900">
                {b.name} — {b.adapterType}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Integrations */}
      <section className="rounded-lg border border-neutral-200 bg-white shadow-sm">
        <header className="border-b border-neutral-200 px-5 py-3">
          <h2 className="text-sm font-medium text-neutral-900">{t("pages.system.integrations")}</h2>
        </header>
        {integrationList.length === 0 ? (
          <EmptyState title={t("pages.system.integrations")} className="py-8" />
        ) : (
          <div>
            {integrationList.map((integration) => (
              <IntegrationRow
                key={integration.port}
                port={integration.port}
                adapter={integration.adapter}
                status={integration.status}
              />
            ))}
          </div>
        )}
      </section>

      {/* System health */}
      <section className="rounded-lg border border-neutral-200 bg-white shadow-sm">
        <header className="border-b border-neutral-200 px-5 py-3">
          <h2 className="text-sm font-medium text-neutral-900">{t("pages.system.health")}</h2>
        </header>
        {indicators.length === 0 ? (
          <EmptyState title={t("pages.system.noIndicators")} className="py-8" />
        ) : (
          <ul className="divide-y divide-neutral-100">
            {indicators.map((indicator) => (
              <li key={indicator.name} className="flex items-center gap-3 px-5 py-3 text-sm">
                <span
                  className={`size-2 rounded-full ${
                    indicator.status === "ok"
                      ? "bg-ok"
                      : indicator.status === "degraded"
                        ? "bg-amber-400"
                        : indicator.status === "failing"
                          ? "bg-red-500"
                          : "bg-neutral-300"
                  }`}
                  aria-hidden
                />
                <span className="font-mono text-[12.5px] text-neutral-700">{indicator.name}</span>
                <span className="ml-auto text-[12px] text-neutral-500">{indicator.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
