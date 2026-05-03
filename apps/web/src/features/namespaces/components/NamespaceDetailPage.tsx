import { Link } from "@tanstack/react-router";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import { EmptyState } from "@/components/common/EmptyState";
import {
  useNamespace,
  useNamespacePolicies,
  useNamespacePresets,
} from "@/features/namespaces/hooks/useNamespaces";

const TABS = ["overview", "policy", "presets", "assets", "webhooks", "quotas"] as const;
type Tab = (typeof TABS)[number];

interface INamespaceDetailPageProps {
  slug: string;
}

export function NamespaceDetailPage({ slug }: INamespaceDetailPageProps): React.JSX.Element {
  const { t } = useTranslation();
  const { data: ns, isLoading, error } = useNamespace(slug);
  const [active, setActive] = useState<Tab>("overview");

  // Consume the hooks to satisfy the contract even if unused in Slice 0
  useNamespacePolicies(slug);
  useNamespacePresets(slug);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-neutral-500">{t("pages.namespaceDetail.loading")}</p>
      </div>
    );
  }

  if (!ns || error) {
    return (
      <div className="space-y-4">
        <EmptyState
          title={t("pages.namespaceDetail.notFound.title")}
          description={t("pages.namespaceDetail.notFound.description")}
          action={
            <Link
              to="/namespaces/"
              className="bg-background hover:bg-accent hover:text-accent-foreground inline-flex items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium whitespace-nowrap shadow-xs transition-all"
            >
              {t("pages.namespaceDetail.notFound.action")}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-[22px] font-bold tracking-tight text-neutral-900">{ns.displayName}</h1>
      </header>

      {/* Tab list */}
      <div
        role="tablist"
        aria-label={t("pages.namespaceDetail.title")}
        className="flex gap-1 border-b border-neutral-200"
      >
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            id={`tab-${tab}`}
            aria-selected={active === tab}
            aria-controls={`panel-${tab}`}
            onClick={() => {
              setActive(tab);
            }}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              active === tab
                ? "border-b-2 border-neutral-900 text-neutral-900"
                : "text-neutral-500 hover:text-neutral-700"
            }`}
          >
            {t(`pages.namespaceDetail.tabs.${tab}`)}
          </button>
        ))}
      </div>

      {/* Tab panel */}
      <div
        role="tabpanel"
        id={`panel-${active}`}
        aria-labelledby={`tab-${active}`}
        className="rounded-lg border border-neutral-200 bg-white shadow-sm"
      >
        <EmptyState title={t(`pages.namespaceDetail.empty.${active}`)} className="py-12" />
      </div>
    </div>
  );
}
