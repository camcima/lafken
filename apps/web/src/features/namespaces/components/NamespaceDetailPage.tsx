import type {
  NamespacePolicyResponseDTO,
  NamespacePresetResponseDTO,
  NamespaceResponseDTO,
} from "@shared/backend-api";
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

import { ArchiveNamespaceDialog } from "./ArchiveNamespaceDialog";
import { NamespaceMetadataDrawer } from "./NamespaceMetadataDrawer";
import { PastVersionsPanel } from "./PastVersionsPanel";
import { RealPresetsTab } from "./RealPresetsTab";

const BACK_ICON_SIZE = 14;
const ISO_DATE_LENGTH = 10;

const TABS = ["overview", "policy", "presets"] as const;
type INamespaceTab = (typeof TABS)[number];

interface INamespaceDetailPageProps {
  slug: string;
  /** Active tab — driven from URL searchParam in the route wrapper */
  tab?: INamespaceTab;
  onTabChange?: (tab: INamespaceTab) => void;
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().slice(0, ISO_DATE_LENGTH);
}

/**
 * Counts the number of distinct preset names where the highest-version row
 * for that name is active. Mirrors the dedup-by-name + latest-wins logic in
 * RealPresetsTab so the overview stat lines up with what the Presets tab
 * shows.
 */
function countActivePresetGroups(presets: NamespacePresetResponseDTO[]): number {
  const latestByName = new Map<string, NamespacePresetResponseDTO>();
  for (const preset of presets) {
    const existing = latestByName.get(preset.name);
    if (!existing || preset.version > existing.version) {
      latestByName.set(preset.name, preset);
    }
  }
  let active = 0;
  for (const [, preset] of latestByName) {
    if (preset.active) active += 1;
  }
  return active;
}

interface IStatTile {
  label: string;
  value: string;
}

function OverviewTab({
  namespace,
  presets,
}: {
  namespace: NamespaceResponseDTO;
  presets: NamespacePresetResponseDTO[];
}): React.JSX.Element {
  const { t } = useTranslation();

  const isArchived = Boolean(namespace.archivedAt);
  const activePresetCount = countActivePresetGroups(presets);
  const showUpdated = namespace.updatedAt !== namespace.createdAt;

  const tiles: IStatTile[] = [
    {
      label: t("pages.namespaceDetail.overview.stats.policyVersion"),
      value: `v${namespace.currentPolicyVersion}`,
    },
    {
      label: t("pages.namespaceDetail.overview.stats.storageBinding"),
      value: namespace.storageBindingName,
    },
    {
      label: t("pages.namespaceDetail.overview.stats.presetsActive"),
      value: String(activePresetCount),
    },
    {
      label: t("pages.namespaceDetail.overview.stats.created"),
      value: formatDate(namespace.createdAt),
    },
  ];
  if (showUpdated) {
    tiles.push({
      label: t("pages.namespaceDetail.overview.stats.updated"),
      value: formatDate(namespace.updatedAt),
    });
  }

  return (
    <div className="space-y-4">
      {namespace.description ? (
        <p className="text-muted-foreground max-w-3xl text-[12.5px] leading-relaxed">
          {namespace.description}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((tile) => (
          <Card key={tile.label} className="px-4 py-3">
            <div className="text-muted-foreground text-[10.5px] tracking-wider uppercase">
              {tile.label}
            </div>
            <div className="mt-0.5 truncate font-mono text-[18px] leading-tight tabular-nums">
              {tile.value}
            </div>
          </Card>
        ))}

        <Card className="px-4 py-3">
          <div className="text-muted-foreground text-[10.5px] tracking-wider uppercase">
            {t("pages.namespaceDetail.overview.stats.state")}
          </div>
          <div className="mt-1">
            {isArchived ? (
              <Badge variant="muted">{t("pages.namespaceDetail.overview.state.archived")}</Badge>
            ) : (
              <Badge variant="ok">{t("pages.namespaceDetail.overview.state.active")}</Badge>
            )}
          </div>
        </Card>
      </div>
    </div>
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

export function NamespaceDetailPage({
  slug,
  tab,
  onTabChange,
}: INamespaceDetailPageProps): React.JSX.Element {
  const { t } = useTranslation();
  const { isLoading, data: namespace } = useNamespace(slug);
  const { data: policiesData } = useNamespacePolicies(slug);
  const { data: presetsData } = useNamespacePresets(slug);

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
            <Button asChild variant="outline">
              <Link to="/assets" search={{ namespaceSlug: namespace.slug }}>
                {t("pages.namespaces.actions.viewAssets")}
              </Link>
            </Button>
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
      {activeTab === "overview" && (
        <OverviewTab namespace={namespace} presets={presetsData ?? []} />
      )}
      {activeTab === "policy" && (
        <RealPolicyTab
          namespace={namespace}
          policies={policiesData ?? []}
          selectedVersion={selectedVersion}
          onSelectVersion={setSelectedVersion}
        />
      )}
      {activeTab === "presets" && <RealPresetsTab namespace={namespace} />}

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
