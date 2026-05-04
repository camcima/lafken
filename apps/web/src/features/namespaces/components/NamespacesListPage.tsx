// Slice 2a: wire real namespace data; fall back to demo when BE returns empty
import type { NamespaceResponseDTO } from "@shared/backend-api";
import { Link } from "@tanstack/react-router";
import { Layers, Plus, Search, Shield } from "lucide-react";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Card, CardHeader, CardMeta, CardTitle } from "@/components/common/Card";
import { RightDrawer } from "@/components/common/RightDrawer";
import { useNamespaces } from "@/features/namespaces/hooks/useNamespaces";
import { DEMO_NAMESPACES, type DemoNamespace } from "@/lib/demo/lafken-demo-data";
import { cn } from "@/lib/utils";

const ICON_SM = 10;
const ICON_MD = 13;
const ICON_LG = 18;
const UPLOADS_PER_ASSET_RATIO = 0.0008;
const ISO_DATE_LENGTH = 10;

// ── Demo layout ───────────────────────────────────────────

function NamespaceCard({
  ns,
  onClick,
}: {
  ns: DemoNamespace;
  onClick: () => void;
}): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <Card className="hover:border-latam-indigo/30 p-0 transition-all hover:shadow-md">
      <button onClick={onClick} className="block w-full text-left" type="button">
        <div className="flex items-start gap-3 px-5 py-4">
          <div className="bg-latam-indigo/10 text-latam-indigo-deep grid size-10 flex-none place-items-center rounded">
            <Layers size={ICON_LG} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <h2 className="m-0 truncate text-[14px] font-semibold">{ns.displayName}</h2>
              <Badge variant="muted">
                {t("pages.namespaces.policyVersion", { version: ns.policyVersion })}
              </Badge>
              {ns.moderation ? (
                <Badge variant="indigo-soft">
                  <Shield size={ICON_SM} />
                  {t("pages.namespaces.moderation.enabled")}
                </Badge>
              ) : (
                <Badge variant="muted">{t("pages.namespaces.moderation.none")}</Badge>
              )}
            </div>
            <div className="text-muted-foreground mt-0.5 font-mono text-[11.5px]">{ns.slug}</div>
          </div>
        </div>

        <div className="border-border grid grid-cols-2 border-t sm:grid-cols-4">
          {[
            { label: t("pages.namespaces.stats.assets"), value: ns.assetCount.toLocaleString() },
            { label: t("pages.namespaces.stats.retention"), value: ns.retention },
            { label: t("pages.namespaces.stats.maxSize"), value: ns.maxBytes },
            {
              label: t("pages.namespaces.stats.holds"),
              value: ns.holdsCount,
              warn: ns.holdsCount > 0,
            },
          ].map((stat) => (
            <div key={stat.label} className="border-border border-r px-4 py-2.5 last:border-r-0">
              <div className="text-muted-foreground text-[10.5px] tracking-wider uppercase">
                {stat.label}
              </div>
              <div className={cn("font-mono text-[14px] tabular-nums", stat.warn && "text-warn")}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        <div className="border-border bg-secondary/30 flex items-center justify-between border-t px-5 py-2 text-[11.5px]">
          <span className="text-muted-foreground font-mono">
            {t("pages.namespaces.owner")}: {ns.owner}
          </span>
          {ns.quarantine > 0 ? (
            <span className="text-alert">
              <Shield size={ICON_SM} className="mr-1 inline -translate-y-px" />
              {t("pages.namespaces.quarantineCount", { count: ns.quarantine })}
            </span>
          ) : (
            <span className="text-ok">{t("pages.namespaces.queueClean")}</span>
          )}
        </div>
      </button>
    </Card>
  );
}

function NamespaceDrawer({
  ns,
  onClose,
}: {
  ns: DemoNamespace;
  onClose: () => void;
}): React.JSX.Element {
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

  const activityRows = [
    {
      label: t("pages.namespaces.drawer.activity.uploads"),
      value: Math.floor(ns.assetCount * UPLOADS_PER_ASSET_RATIO).toLocaleString(),
    },
    {
      label: t("pages.namespaces.drawer.activity.quarantine"),
      value: ns.quarantine,
      tone: ns.quarantine > 0 ? "alert" : undefined,
    },
    {
      label: t("pages.namespaces.drawer.activity.holds"),
      value: ns.holdsCount,
      tone: ns.holdsCount > 0 ? "warn" : undefined,
    },
  ];

  return (
    <RightDrawer
      open
      onClose={onClose}
      maxWidthClass="max-w-[640px]"
      caption={t("pages.namespaces.drawer.caption")}
      title={ns.displayName}
      footer={
        <>
          <Button variant="outline">{t("pages.namespaces.drawer.viewAssets")}</Button>
          <Button variant="outline">{t("pages.namespaces.drawer.editPolicy")}</Button>
        </>
      }
    >
      <div className="space-y-5 px-5 py-5">
        {/* Policy summary */}
        <Card className="p-0">
          <CardHeader>
            <CardTitle>
              {t("pages.namespaces.drawer.policyTitle", { version: ns.policyVersion })}
            </CardTitle>
            <CardMeta>{t("pages.namespaces.drawer.policyMeta")}</CardMeta>
          </CardHeader>
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 px-5 py-4 text-[12px] sm:grid-cols-2">
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

        {/* Required metadata */}
        <Card>
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

        {/* Activity */}
        <Card>
          <CardHeader>
            <CardTitle>{t("pages.namespaces.drawer.activity.title")}</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-3 gap-3 px-5 py-4">
            {activityRows.map((stat) => (
              <div
                key={stat.label}
                className="border-border bg-secondary/30 rounded border px-3 py-3 text-center"
              >
                <div
                  className={cn(
                    "font-mono text-[20px] tabular-nums",
                    stat.tone === "alert" && "text-alert",
                    stat.tone === "warn" && "text-warn",
                  )}
                >
                  {stat.value}
                </div>
                <div className="text-muted-foreground text-[10.5px] tracking-wider uppercase">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </RightDrawer>
  );
}

// ── Real data layout ──────────────────────────────────────

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().slice(0, ISO_DATE_LENGTH);
}

function RealNamespaceRow({ ns }: { ns: NamespaceResponseDTO }): React.JSX.Element {
  const { t } = useTranslation();
  const isArchived = ns.archivedAt !== null && ns.archivedAt !== undefined;

  return (
    <Link
      to="/namespaces/$slug"
      params={{ slug: ns.slug }}
      className="border-border/40 hover:bg-secondary/30 flex items-start justify-between gap-3 border-b px-5 py-3 last:border-b-0"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-mono text-[13px] font-semibold">{ns.slug}</span>
          <span className="text-[12.5px]">{ns.displayName}</span>
          {isArchived ? <Badge variant="muted">{t("pages.namespaces.archivedBadge")}</Badge> : null}
        </div>
        <div className="text-muted-foreground mt-0.5 grid grid-cols-1 gap-x-3 gap-y-0.5 font-mono text-[11px] sm:grid-cols-3">
          <span>
            <span className="text-muted-foreground/80">
              {t("pages.namespaces.table.policyVersion")}:
            </span>{" "}
            {t("pages.namespaces.policyVersion", { version: ns.currentPolicyVersion })}
          </span>
          <span className="truncate">
            <span className="text-muted-foreground/80">{t("pages.namespaces.table.storage")}:</span>{" "}
            {ns.storageBindingName}
          </span>
          <span>
            <span className="text-muted-foreground/80">
              {t("pages.system.storageBindings.real.createdAt")}:
            </span>{" "}
            {formatDate(ns.createdAt)}
          </span>
        </div>
      </div>
    </Link>
  );
}

// ── Main page ─────────────────────────────────────────────

export function NamespacesListPage(): React.JSX.Element {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  const { data: page } = useNamespaces({ page: 1, limit: 50 });
  const real: NamespaceResponseDTO[] = page?.data ?? [];
  const usingDemo = real.length === 0;

  const filteredDemo = DEMO_NAMESPACES.filter(
    (ns) =>
      !query ||
      ns.slug.includes(query.toLowerCase()) ||
      ns.displayName.toLowerCase().includes(query.toLowerCase()),
  );

  const filteredReal = real.filter(
    (ns) =>
      !query ||
      ns.slug.includes(query.toLowerCase()) ||
      ns.displayName.toLowerCase().includes(query.toLowerCase()),
  );

  const openNs = DEMO_NAMESPACES.find((ns) => ns.slug === openSlug);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-[22px] font-bold tracking-tight">
            {t("pages.namespaces.title")}
            {usingDemo ? (
              <span className="text-muted-foreground ml-2 text-[13px] font-normal">
                {t("pages.namespaces.demoLabel")}
              </span>
            ) : null}
          </h1>
          <div className="text-muted-foreground mt-1 text-[12.5px]">
            {t("pages.namespaces.subtitle")}
          </div>
        </div>
        <Link to="/namespaces/new">
          <Button variant="indigo" type="button">
            <Plus size={ICON_MD} />
            {t("pages.namespaces.actions.newNamespace")}
          </Button>
        </Link>
      </div>

      {/* Search */}
      <Card className="mb-4 p-3">
        <div className="relative">
          <Search
            size={ICON_MD}
            className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2"
          />
          <input
            type="search"
            placeholder={t("pages.namespaces.searchPlaceholder")}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
            className="border-input placeholder:text-muted-foreground focus:ring-latam-indigo/50 h-9 w-full rounded-md border bg-transparent pr-3 pl-9 text-[12.5px] outline-none focus:ring-1"
          />
        </div>
      </Card>

      {/* Real data layout */}
      {!usingDemo ? (
        <Card className="p-0">
          <div className="py-1">
            {filteredReal.map((ns) => (
              <RealNamespaceRow key={ns.slug} ns={ns} />
            ))}
          </div>
        </Card>
      ) : (
        /* Demo card layout */
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filteredDemo.map((ns) => (
            <NamespaceCard
              key={ns.slug}
              ns={ns}
              onClick={() => {
                setOpenSlug(ns.slug);
              }}
            />
          ))}
        </div>
      )}

      {/* Demo drawer (only shown in demo mode) */}
      {openNs ? (
        <NamespaceDrawer
          ns={openNs}
          onClose={() => {
            setOpenSlug(null);
          }}
        />
      ) : null}
    </div>
  );
}
