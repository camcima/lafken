// Slice 0: BE returns empty arrays; rendering against typed demo data
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/common/Badge";
import { Card, CardHeader, CardMeta, CardTitle } from "@/components/common/Card";
import { EmptyState } from "@/components/common/EmptyState";
import { Tabs } from "@/components/common/Tabs";
import type { ITab } from "@/components/common/Tabs";
import {
  useNamespace,
  useNamespacePolicies,
  useNamespacePresets,
} from "@/features/namespaces/hooks/useNamespaces";
import { DEMO_AUDIT, DEMO_NAMESPACES, type DemoNamespace } from "@/lib/demo/lafken-demo-data";
import { fmtAgo } from "@/lib/demo/lafken-demo-data";
import { cn } from "@/lib/utils";

const BACK_ICON_SIZE = 14;
const RECENT_AUDIT_COUNT = 5;

const TABS = ["overview", "policy", "presets", "assets", "webhooks", "quotas"] as const;
type INamespaceTab = (typeof TABS)[number];

interface INamespaceDetailPageProps {
  slug: string;
  /** Active tab — driven from URL searchParam in the route wrapper */
  tab?: INamespaceTab;
  onTabChange?: (tab: INamespaceTab) => void;
}

function OverviewTab({ ns }: { ns: DemoNamespace }): React.JSX.Element {
  const { t } = useTranslation();
  const recentAudit = DEMO_AUDIT.filter((e) => e.namespace === ns.slug).slice(
    0,
    RECENT_AUDIT_COUNT,
  );

  return (
    <div className="grid gap-4">
      {/* Stats */}
      <Card className="p-0">
        <div className="grid grid-cols-2 sm:grid-cols-4">
          {[
            {
              label: t("pages.namespaces.stats.assets"),
              value: ns.assetCount.toLocaleString(),
            },
            { label: t("pages.namespaces.stats.retention"), value: ns.retention },
            { label: t("pages.namespaces.stats.maxSize"), value: ns.maxBytes },
            {
              label: t("pages.namespaces.stats.holds"),
              value: ns.holdsCount,
              warn: ns.holdsCount > 0,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="border-border border-r px-5 py-4 first:rounded-tl-md last:border-r-0"
            >
              <div className="text-muted-foreground text-[10.5px] tracking-wider uppercase">
                {stat.label}
              </div>
              <div className={cn("font-mono text-[20px] tabular-nums", stat.warn && "text-warn")}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Latest activity */}
      <Card className="p-0">
        <CardHeader>
          <CardTitle>{t("pages.namespaceDetail.overview.latestActivity")}</CardTitle>
          <CardMeta>{t("pages.namespaceDetail.overview.latestActivityMeta")}</CardMeta>
        </CardHeader>
        {recentAudit.length === 0 ? (
          <div className="text-muted-foreground px-5 py-8 text-center text-[12.5px]">
            {t("pages.namespaceDetail.overview.noActivity")}
          </div>
        ) : (
          <div>
            {recentAudit.map((e) => (
              <div
                key={e.id}
                className="border-border/40 flex items-center gap-3 border-b px-5 py-2.5 last:border-b-0"
              >
                <span
                  className={cn(
                    "size-1.5 flex-none rounded-full",
                    e.result === "ok" ? "bg-ok" : "bg-danger",
                  )}
                />
                <span className="flex-1 font-mono text-[11.5px]">{e.type}</span>
                <span className="text-muted-foreground font-mono text-[10.5px]">{e.actor}</span>
                <span className="text-muted-foreground font-mono text-[10.5px]">
                  {fmtAgo(e.minutesAgo)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function PolicyTab({ ns }: { ns: DemoNamespace }): React.JSX.Element {
  const { t } = useTranslation();

  const policyRows: Array<[string, React.ReactNode]> = [
    [t("pages.namespaces.drawer.retention"), ns.retention],
    [t("pages.namespaces.drawer.maxSize"), ns.maxBytes],
    [t("pages.namespaces.drawer.allowedTypes"), t("pages.namespaces.allowedTypes.demoValue")],
    [
      t("pages.namespaces.drawer.moderation"),
      ns.moderation
        ? t("pages.namespaces.drawer.moderationEnabled")
        : t("pages.namespaces.drawer.moderationDisabled"),
    ],
    [t("pages.namespaces.drawer.exifPolicy"), t("pages.namespaces.drawer.exifPolicyValue")],
    [t("pages.namespaces.drawer.storageBinding"), t("pages.namespaces.drawer.storageBindingValue")],
    [
      t("pages.namespaces.drawer.owner"),
      <span key="owner" className="font-mono">
        {ns.owner}
      </span>,
    ],
    [
      t("pages.namespaces.drawer.reviewers"),
      <span key="rev" className="font-mono">
        {t("pages.namespaces.drawer.reviewersValue")}
      </span>,
    ],
  ];

  return (
    <div className="grid gap-4">
      <Card className="p-0">
        <CardHeader>
          <CardTitle>
            {t("pages.namespaces.drawer.policyTitle", { version: ns.policyVersion })}
          </CardTitle>
          <CardMeta>{t("pages.namespaces.drawer.policyMeta")}</CardMeta>
        </CardHeader>
        <div className="grid grid-cols-1 gap-x-8 gap-y-3 px-5 py-5 text-[12.5px] sm:grid-cols-2">
          {policyRows.map(([rowKey, rowVal]) => (
            <div key={rowKey}>
              <div className="text-muted-foreground text-[10.5px] tracking-wider uppercase">
                {rowKey}
              </div>
              <div className="font-mono text-[12px]">{rowVal}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-0">
        <CardHeader>
          <CardTitle>{t("pages.namespaces.drawer.requiredMetadata")}</CardTitle>
        </CardHeader>
        <div className="grid gap-2 px-5 py-4 text-[12px]">
          {ns.required.map((field) => (
            <div
              key={field}
              className="border-border bg-secondary/30 flex items-center justify-between rounded border px-3 py-2 font-mono text-[11.5px]"
            >
              <span>{field}</span>
              <Badge variant="indigo-soft">{t("pages.namespaces.drawer.requiredBadge")}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function SliceLaterTab({ label }: { label: string }): React.JSX.Element {
  return (
    <Card>
      <div className="px-6 py-12 text-center">
        <div className="text-muted-foreground text-[14px] font-medium">{label}</div>
      </div>
    </Card>
  );
}

export function NamespaceDetailPage({
  slug,
  tab,
  onTabChange,
}: INamespaceDetailPageProps): React.JSX.Element {
  const { t } = useTranslation();
  const { isLoading } = useNamespace(slug);

  // Consume the hooks to satisfy the contract even if unused in Slice 0
  useNamespacePolicies(slug);
  useNamespacePresets(slug);

  // Find demo namespace for content rendering
  const demoNs = DEMO_NAMESPACES.find((ns) => ns.slug === slug);

  // Active tab — falls back to overview
  const activeTab: INamespaceTab = tab ?? "overview";

  const tabItems: ITab<INamespaceTab>[] = TABS.map((id) => ({
    id,
    label: t(`pages.namespaceDetail.tabs.${id}`),
  }));

  if (isLoading) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">{t("pages.namespaceDetail.loading")}</p>
      </div>
    );
  }

  // Not-found: no demo data to show (Slice 0 always has API error — use demo fallback)
  if (!demoNs) {
    return (
      <div className="space-y-4">
        <EmptyState
          title={t("pages.namespaceDetail.notFound.title")}
          description={t("pages.namespaceDetail.notFound.description")}
          action={
            <Link
              to="/namespaces"
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
      {/* Back link + header */}
      <div>
        <Link
          to="/namespaces"
          className="text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1.5 text-[12px]"
        >
          <ArrowLeft size={BACK_ICON_SIZE} />
          {t("pages.namespaceDetail.backToNamespaces")}
        </Link>
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-[22px] font-bold tracking-tight">{demoNs.displayName}</h1>
          <span className="text-muted-foreground font-mono text-[12.5px]">{demoNs.slug}</span>
          <Badge variant="muted">
            {t("pages.namespaces.policyVersion", { version: demoNs.policyVersion })}
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs<INamespaceTab>
        value={activeTab}
        onValueChange={(id) => {
          onTabChange?.(id);
        }}
        items={tabItems}
      />

      {/* Tab panels */}
      {activeTab === "overview" && <OverviewTab ns={demoNs} />}
      {activeTab === "policy" && <PolicyTab ns={demoNs} />}
      {activeTab === "presets" && (
        <SliceLaterTab label={t("pages.namespaceDetail.empty.presets")} />
      )}
      {activeTab === "assets" && <SliceLaterTab label={t("pages.namespaceDetail.empty.assets")} />}
      {activeTab === "webhooks" && (
        <SliceLaterTab label={t("pages.namespaceDetail.empty.webhooks")} />
      )}
      {activeTab === "quotas" && <SliceLaterTab label={t("pages.namespaceDetail.empty.quotas")} />}
    </div>
  );
}
