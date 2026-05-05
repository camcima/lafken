// Slice 0: BE returns empty arrays; rendering against typed demo data
import type { NamespacePolicyResponseDTO, NamespaceResponseDTO } from "@shared/backend-api";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Card, CardHeader, CardMeta, CardTitle } from "@/components/common/Card";
import { EmptyState } from "@/components/common/EmptyState";
import { Tabs } from "@/components/common/Tabs";
import type { ITab } from "@/components/common/Tabs";
import {
  useNamespace,
  useNamespacePolicies,
  useNamespacePresets,
} from "@/features/namespaces/hooks/useNamespaces";
import { isDemoMode } from "@/lib/demo/demo-mode";
import { DEMO_AUDIT, DEMO_NAMESPACES, type DemoNamespace } from "@/lib/demo/lafken-demo-data";
import { fmtAgo } from "@/lib/demo/lafken-demo-data";
import { cn } from "@/lib/utils";

import { ArchiveNamespaceDialog } from "./ArchiveNamespaceDialog";
import { NamespaceAssetsTab } from "./NamespaceAssetsTab";
import { NamespaceMetadataDrawer } from "./NamespaceMetadataDrawer";
import { PastVersionsPanel } from "./PastVersionsPanel";
import { RealPresetsTab } from "./RealPresetsTab";

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

function DemoPresetsTab({ ns }: { ns: DemoNamespace }): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <Card>
      <div className="px-6 py-12 text-center">
        <div className="text-muted-foreground text-[14px] font-medium">
          {t("pages.namespaces.presets.title")} — {ns.slug} {t("pages.namespaces.demoLabel")}
        </div>
      </div>
    </Card>
  );
}

interface IRealPolicyTabProps {
  namespace: NamespaceResponseDTO;
  policies: NamespacePolicyResponseDTO[];
  selectedVersion: number;
  onSelectVersion: (version: number) => void;
}

function RealPolicyTab({
  namespace,
  policies,
  selectedVersion,
  onSelectVersion,
}: IRealPolicyTabProps): React.JSX.Element {
  const { t } = useTranslation();

  const displayPolicy =
    policies.find((policy) => policy.version === selectedVersion) ?? policies[0];

  const policyRows: Array<[string, React.ReactNode]> = displayPolicy
    ? [
        [
          t("pages.namespaceDetail.policy.fields.version"),
          <span key="version" className="font-mono">
            v{displayPolicy.version}
          </span>,
        ],
        [
          t("pages.namespaceDetail.policy.fields.retentionMode"),
          <span key="retentionMode" className="font-mono">
            {displayPolicy.retentionMode}
          </span>,
        ],
        [
          t("pages.namespaceDetail.policy.fields.retentionDays"),
          <span key="retentionDays" className="font-mono">
            {displayPolicy.retentionDays ?? "—"}
          </span>,
        ],
        [
          t("pages.namespaceDetail.policy.fields.maxFileSizeBytes"),
          <span key="maxFileSize" className="font-mono">
            {displayPolicy.maxFileSizeBytes.toLocaleString()}
          </span>,
        ],
        [
          t("pages.namespaceDetail.policy.fields.allowedMimeTypes"),
          <span key="mimeTypes" className="font-mono">
            {displayPolicy.allowedMimeTypes.join(", ")}
          </span>,
        ],
        [
          t("pages.namespaceDetail.policy.fields.exifHandling"),
          <span key="exifHandling" className="font-mono">
            {displayPolicy.exifHandling}
          </span>,
        ],
        [
          t("pages.namespaceDetail.policy.fields.virusScanRequired"),
          <span key="virusScan" className="font-mono">
            {displayPolicy.virusScanRequired
              ? t("pages.namespaces.drawer.moderationEnabled")
              : t("pages.namespaces.drawer.moderationDisabled")}
          </span>,
        ],
        [
          t("pages.namespaceDetail.policy.fields.servingMode"),
          <span key="servingMode" className="font-mono">
            {displayPolicy.servingMode}
          </span>,
        ],
        [
          t("pages.namespaceDetail.policy.fields.immutable"),
          <span key="immutable" className="font-mono">
            {String(displayPolicy.immutable)}
          </span>,
        ],
        [
          t("pages.namespaceDetail.policy.fields.contentModeration"),
          <span key="contentModeration" className="font-mono">
            {displayPolicy.contentModeration !== null &&
            displayPolicy.contentModeration !== undefined
              ? t("pages.namespaceDetail.policy.configured")
              : t("pages.namespaceDetail.policy.notConfigured")}
          </span>,
        ],
        [
          t("pages.namespaceDetail.policy.fields.requiredMetadataSchema"),
          <span key="requiredMetadataSchema" className="font-mono">
            {displayPolicy.requiredMetadataSchema !== null &&
            displayPolicy.requiredMetadataSchema !== undefined
              ? t("pages.namespaceDetail.policy.configured")
              : t("pages.namespaceDetail.policy.notConfigured")}
          </span>,
        ],
        [
          t("pages.namespaceDetail.policy.fields.signedUrlTtlSeconds"),
          <span key="signedUrlTtlSeconds" className="font-mono">
            {displayPolicy.signedUrlTtlSeconds !== null &&
            displayPolicy.signedUrlTtlSeconds !== undefined
              ? `${displayPolicy.signedUrlTtlSeconds} s`
              : "—"}
          </span>,
        ],
        [
          t("pages.namespaceDetail.policy.fields.signedUrlBucketSize"),
          <span key="signedUrlBucketSize" className="font-mono">
            {displayPolicy.signedUrlBucketSize !== null &&
            displayPolicy.signedUrlBucketSize !== undefined
              ? String(displayPolicy.signedUrlBucketSize)
              : "—"}
          </span>,
        ],
        [
          t("pages.namespaceDetail.policy.fields.retryConfig"),
          <span key="retryConfig" className="font-mono">
            {displayPolicy.retryConfig !== null && displayPolicy.retryConfig !== undefined
              ? t("pages.namespaceDetail.policy.configured")
              : t("pages.namespaceDetail.policy.notConfigured")}
          </span>,
        ],
        [
          t("pages.namespaceDetail.policy.fields.createdAt"),
          <span key="createdAt" className="font-mono">
            {new Date(displayPolicy.createdAt).toLocaleString()}
          </span>,
        ],
        [
          t("pages.namespaceDetail.policy.fields.createdBy"),
          <span key="createdBy" className="font-mono">
            {displayPolicy.createdBy ?? "—"}
          </span>,
        ],
      ]
    : [];

  return (
    <div className="grid gap-4">
      <Card className="p-0">
        <CardHeader>
          <CardTitle>
            {t("pages.namespaceDetail.policy.currentVersion", {
              version: selectedVersion,
            })}
          </CardTitle>
          <CardMeta>{t("pages.namespaceDetail.policy.currentVersionMeta")}</CardMeta>
        </CardHeader>
        {displayPolicy ? (
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
        ) : (
          <div className="text-muted-foreground px-5 py-8 text-center text-[12.5px]">
            {t("pages.namespaceDetail.empty.policy")}
          </div>
        )}
      </Card>

      <PastVersionsPanel
        policies={policies}
        currentVersion={namespace.currentPolicyVersion}
        selectedVersion={selectedVersion}
        onSelectVersion={onSelectVersion}
      />
    </div>
  );
}

/** Build a minimal NamespaceResponseDTO from demo data for drawer/dialog usage */
function demoToNamespaceDTO(demoNs: DemoNamespace): NamespaceResponseDTO {
  return {
    slug: demoNs.slug,
    displayName: demoNs.displayName,
    description: undefined,
    currentPolicyVersion: demoNs.policyVersion,
    storageBindingName: "gcs-prod",
    archivedAt: undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function NamespaceDetailPage({
  slug,
  tab,
  onTabChange,
}: INamespaceDetailPageProps): React.JSX.Element {
  const { t } = useTranslation();
  const { isLoading, data: namespaceData } = useNamespace(slug);
  const { data: policiesData } = useNamespacePolicies(slug);

  // Consume presets hook
  useNamespacePresets(slug);

  // Demo content is only used when explicitly enabled and no API namespace was returned.
  const demoNs =
    isDemoMode && !namespaceData ? DEMO_NAMESPACES.find((ns) => ns.slug === slug) : undefined;

  // Derive the namespace DTO: prefer real API data, fall back to demo-derived DTO
  const namespace: NamespaceResponseDTO | undefined =
    namespaceData ?? (demoNs ? demoToNamespaceDTO(demoNs) : undefined);

  // Active tab — falls back to overview
  const activeTab: INamespaceTab = tab ?? "overview";

  const tabItems: ITab<INamespaceTab>[] = TABS.map((id) => ({
    id,
    label: t(`pages.namespaceDetail.tabs.${id}`),
  }));

  // Drawer / dialog state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [archiveMode, setArchiveMode] = useState<"archive" | "unarchive">("archive");

  // Selected policy version for the policy tab (real namespaces only).
  // We store the previous currentPolicyVersion in state so that when it changes
  // (e.g. right after an edit), we can reset the user's selection — following
  // the React pattern for "adjusting state on render" without useEffect.
  const [prevCurrentVersion, setPrevCurrentVersion] = useState(namespace?.currentPolicyVersion);
  const [selectedVersion, setSelectedVersion] = useState(namespace?.currentPolicyVersion ?? 1);

  if (
    namespace?.currentPolicyVersion !== undefined &&
    prevCurrentVersion !== namespace.currentPolicyVersion
  ) {
    setPrevCurrentVersion(namespace.currentPolicyVersion);
    setSelectedVersion(namespace.currentPolicyVersion);
  }

  const isArchived = Boolean(namespace?.archivedAt);

  function handleArchiveClick(): void {
    setArchiveMode(isArchived ? "unarchive" : "archive");
    setDialogOpen(true);
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">{t("pages.namespaceDetail.loading")}</p>
      </div>
    );
  }

  if (!namespace) {
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
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="text-[22px] font-bold tracking-tight">{namespace.displayName}</h1>
            <span className="text-muted-foreground font-mono text-[12.5px]">{namespace.slug}</span>
            <Badge variant="muted">
              {t("pages.namespaces.policyVersion", { version: namespace.currentPolicyVersion })}
            </Badge>
            {isArchived ? (
              <Badge variant="warn">{t("pages.namespaces.archivedBadge")}</Badge>
            ) : null}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDrawerOpen(true);
              }}
            >
              {t("pages.namespaces.actions.editMetadata")}
            </Button>
            {isArchived ? (
              <Button
                type="button"
                variant="indigo"
                disabled
                aria-disabled="true"
                title={t("pages.namespaces.actions.editPolicyArchivedTooltip")}
              >
                {t("pages.namespaces.actions.editPolicy")}
              </Button>
            ) : (
              <Button asChild variant="indigo">
                <Link to="/namespaces/$slug/policy/edit" params={{ slug: namespace.slug }}>
                  {t("pages.namespaces.actions.editPolicy")}
                </Link>
              </Button>
            )}
            <Button
              type="button"
              variant={isArchived ? "outline" : "destructive"}
              onClick={handleArchiveClick}
            >
              {isArchived
                ? t("pages.namespaces.actions.unarchive")
                : t("pages.namespaces.actions.archive")}
            </Button>
          </div>
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
      {activeTab === "overview" &&
        (demoNs ? (
          <OverviewTab ns={demoNs} />
        ) : (
          <SliceLaterTab label={t("pages.namespaceDetail.empty.overview")} />
        ))}
      {activeTab === "policy" &&
        (demoNs ? (
          <PolicyTab ns={demoNs} />
        ) : (
          <RealPolicyTab
            namespace={namespace}
            policies={policiesData ?? []}
            selectedVersion={selectedVersion}
            onSelectVersion={setSelectedVersion}
          />
        ))}
      {activeTab === "presets" &&
        (demoNs ? <DemoPresetsTab ns={demoNs} /> : <RealPresetsTab namespace={namespace} />)}
      {activeTab === "assets" &&
        (demoNs ? (
          <SliceLaterTab label={t("pages.namespaceDetail.empty.assets")} />
        ) : namespace ? (
          <NamespaceAssetsTab namespace={namespace} />
        ) : null)}
      {activeTab === "webhooks" && (
        <SliceLaterTab label={t("pages.namespaceDetail.empty.webhooks")} />
      )}
      {activeTab === "quotas" && <SliceLaterTab label={t("pages.namespaceDetail.empty.quotas")} />}

      {/* Metadata drawer */}
      <NamespaceMetadataDrawer
        open={drawerOpen}
        namespace={namespace}
        onClose={() => {
          setDrawerOpen(false);
        }}
      />

      {/* Archive / unarchive dialog */}
      <ArchiveNamespaceDialog
        open={dialogOpen}
        mode={archiveMode}
        namespace={namespace}
        onClose={() => {
          setDialogOpen(false);
        }}
      />
    </div>
  );
}
