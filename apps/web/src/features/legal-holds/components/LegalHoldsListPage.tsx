import type { LegalHoldResponseDTO } from "@shared/backend-api";
import { Link, useSearch } from "@tanstack/react-router";
import {
  Check,
  ChevronRight,
  Clock,
  Eye,
  Globe,
  Image,
  Layers,
  Lock,
  Plus,
  Search,
  Tag,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { Label } from "@/components/common/Label";
import { Paginator } from "@/components/common/Paginator";
import { RightDrawer } from "@/components/common/RightDrawer";
import { SELECT_CLASS, SELECT_CLASS_SM } from "@/components/common/select-styles";
import { LiftLegalHoldDialog } from "@/features/legal-holds/components/LiftLegalHoldDialog";
import { useLegalHolds } from "@/features/legal-holds/hooks/useLegalHolds";
import { isDemoMode } from "@/lib/demo/demo-mode";
import { DEMO_LEGAL_HOLDS } from "@/lib/demo/lafken-demo-data";
import { cn } from "@/lib/utils";

// ── Constants ─────────────────────────────────────────────────────────────

const SCOPE_ICON_DEFAULT_SIZE = 12;
const BADGE_ICON_SIZE = 10;
const BTN_ICON_SIZE = 13;
const CHEVRON_SIZE = 12;
const CHECK_ICON_SIZE = 12;
const SEARCH_ICON_SIZE = 13;
const DATE_SLICE_END = 10;

/* eslint-disable no-magic-numbers */
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 25;
/* eslint-enable no-magic-numbers */

// Shared grid column definition
const TABLE_COLS =
  "grid-cols-[minmax(0,1.4fr)_120px_minmax(0,2fr)_85px_minmax(0,1.2fr)_110px_120px_34px]";

// ── Normalised row type ───────────────────────────────────────────────────
//
// Both DemoLegalHold and LegalHoldResponseDTO map onto this shape before
// rendering. Only DemoLegalHold has a `scope` field — the API uses
// `scopeSummary` (a pre-formatted string). We expose `scope` as a best-effort
// "asset" fallback for the demo icon; for real rows we set `scope` from
// scopeSummary parsing or leave it blank (the icon falls through to Globe).

interface IHoldRow {
  id: string;
  caseRef: string;
  /** Scope type key used for the icon (demo only; real API uses scopeSummary). */
  scope: string;
  scopeLabel: string;
  assets: number;
  placedBy: string;
  placedAt: string;
  lastReviewed: string;
  reason: string;
  active: boolean;
}

function demoToRow(hold: (typeof DEMO_LEGAL_HOLDS)[number]): IHoldRow {
  return {
    id: hold.id,
    caseRef: hold.caseRef,
    scope: hold.scope,
    scopeLabel: hold.scopeLabel,
    assets: hold.assets,
    placedBy: hold.placedBy,
    placedAt: hold.placedAt,
    lastReviewed: hold.lastReviewed,
    reason: hold.reason,
    active: hold.status === "active" || hold.status === "pending_release",
  };
}

function apiToRow(hold: LegalHoldResponseDTO): IHoldRow {
  return {
    id: hold.id,
    caseRef: hold.caseReference,
    scope: "", // real API uses scopeSummary; icon will render Globe
    scopeLabel: hold.scopeSummary,
    assets: hold.affectedAssetCount,
    placedBy: hold.placedBy,
    placedAt: hold.placedAt,
    lastReviewed: hold.liftedAt ?? hold.placedAt,
    reason: hold.description,
    active: hold.active,
  };
}

// ── ScopeIcon ─────────────────────────────────────────────────────────────

interface IScopeIconProps {
  scope: string;
  size?: number;
  className?: string;
}

function ScopeIcon({
  scope,
  size = SCOPE_ICON_DEFAULT_SIZE,
  className,
}: IScopeIconProps): React.JSX.Element {
  if (scope === "asset") return <Image size={size} className={className} />;
  if (scope === "work_order") return <Tag size={size} className={className} />;
  if (scope === "namespace") return <Layers size={size} className={className} />;
  return <Globe size={size} className={className} />;
}

// ── HoldDrawer ────────────────────────────────────────────────────────────

interface IHoldDrawerProps {
  hold: IHoldRow;
  onClose: () => void;
  onLift: () => void;
}

function HoldDrawer({ hold, onClose, onLift }: IHoldDrawerProps): React.JSX.Element {
  const { t } = useTranslation();
  const scopeLabels: Record<string, string> = {
    asset: t("pages.legalHolds.scopes.asset"),
    work_order: t("pages.legalHolds.scopes.workOrder"),
    namespace: t("pages.legalHolds.scopes.namespace"),
    uploader_window: t("pages.legalHolds.scopes.uploaderWindow"),
  };

  const activities = [
    {
      title: t("pages.legalHolds.drawer.activity.quarterlyReviewConfirmed"),
      at: hold.lastReviewed.slice(0, DATE_SLICE_END),
      by: hold.placedBy,
    },
    {
      title: t("pages.legalHolds.drawer.activity.counselConfirmedScope"),
      at: "2026-04-15",
      by: t("pages.legalHolds.drawer.legalBot"),
    },
    {
      title: t("pages.legalHolds.drawer.activity.holdPlaced"),
      at: hold.placedAt.slice(0, DATE_SLICE_END),
      by: hold.placedBy,
    },
  ];

  return (
    <RightDrawer
      open
      onClose={onClose}
      caption={t("pages.legalHolds.drawer.caption")}
      title={hold.caseRef}
      maxWidthClass="max-w-[520px]"
      footer={
        <>
          <Button asChild variant="outline">
            <Link to="/assets" search={{ legalHoldId: hold.id }}>
              <Eye size={BTN_ICON_SIZE} />
              {t("pages.legalHolds.drawer.actions.viewAssets")}
            </Link>
          </Button>
          {hold.active && (
            <Button variant="danger" onClick={onLift}>
              <Lock size={BTN_ICON_SIZE} />
              {t("pages.legalHolds.lift.submit")}
            </Button>
          )}
        </>
      }
    >
      <div className="flex-1 space-y-5 px-5 py-5">
        <div>
          <Label>{t("pages.legalHolds.drawer.holdId")}</Label>
          <div className="mt-0.5 font-mono text-[12.5px]">{hold.id}</div>
        </div>

        <div>
          <Label>{t("pages.legalHolds.drawer.scope")}</Label>
          <div className="border-border bg-secondary/50 mt-1 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px]">
            <ScopeIcon scope={hold.scope} />
            {scopeLabels[hold.scope] ?? hold.scopeLabel}
          </div>
          {hold.scope !== "" && (
            <div className="text-muted-foreground mt-1.5 font-mono text-[12px]">
              {hold.scopeLabel}
            </div>
          )}
        </div>

        <div>
          <Label>{t("pages.legalHolds.drawer.reason")}</Label>
          <div className="border-border bg-secondary/30 mt-1 rounded border px-3 py-2 text-[12.5px]">
            {hold.reason}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label>{t("pages.legalHolds.drawer.assetsCovered")}</Label>
            <div className="mt-0.5 font-mono text-[18px] tabular-nums">
              {hold.assets.toLocaleString()}
            </div>
          </div>
          <div>
            <Label>{t("pages.legalHolds.drawer.status")}</Label>
            <div className="mt-1">
              {hold.active ? (
                <Badge variant="warn">
                  <Lock size={BADGE_ICON_SIZE} />
                  {t("pages.legalHolds.statuses.active")}
                </Badge>
              ) : (
                <Badge variant="info">
                  <Clock size={BADGE_ICON_SIZE} />
                  {t("pages.legalHolds.statuses.pendingRelease")}
                </Badge>
              )}
            </div>
          </div>
          <div>
            <Label>{t("pages.legalHolds.drawer.placedBy")}</Label>
            <div className="mt-0.5 font-mono text-[12px]">{hold.placedBy}</div>
            <div className="text-muted-foreground text-[11px]">
              {hold.placedAt.replace("T", " ").replace("Z", " UTC")}
            </div>
          </div>
          <div>
            <Label>{t("pages.legalHolds.drawer.lastReviewed")}</Label>
            <div className="mt-0.5 text-[12px]">{hold.lastReviewed.slice(0, DATE_SLICE_END)}</div>
            <div className="text-muted-foreground text-[11px]">
              {t("pages.legalHolds.drawer.reviewCadence")}
            </div>
          </div>
        </div>

        <div>
          <Label>{t("pages.legalHolds.drawer.recentActivity")}</Label>
          <div className="mt-1.5 space-y-2">
            {activities.map((activity) => (
              <div
                key={activity.title}
                className="border-border bg-secondary/30 flex gap-2 rounded border px-3 py-2 text-[11.5px]"
              >
                <Check size={CHECK_ICON_SIZE} className="text-ok mt-0.5 flex-none" />
                <div className="flex-1">
                  <div>{activity.title}</div>
                  <div className="text-muted-foreground font-mono text-[10.5px]">
                    {activity.at} · {activity.by}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </RightDrawer>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export function LegalHoldsListPage(): React.JSX.Element {
  const { t } = useTranslation();
  const { q: initialQ } = useSearch({ from: "/_protected/legal-holds/" });
  const [query, setQuery] = useState(initialQ ?? "");
  const [statusFilter, setStatusFilter] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [liftDialogOpen, setLiftDialogOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Real-API query (skipped in demo mode)
  const realQuery = useLegalHolds({ page: page + 1, limit: pageSize });

  // Normalise both sources to IHoldRow[]
  const allRows: IHoldRow[] = isDemoMode
    ? DEMO_LEGAL_HOLDS.map(demoToRow)
    : (realQuery.data?.data ?? []).map(apiToRow);

  const filtered: IHoldRow[] = allRows.filter((row) => {
    if (statusFilter === "active" && !row.active) return false;
    if (statusFilter === "lifted" && row.active) return false;
    if (query) {
      const lq = query.toLowerCase();
      if (
        !row.caseRef.toLowerCase().includes(lq) &&
        !row.scopeLabel.toLowerCase().includes(lq) &&
        !row.id.toLowerCase().includes(lq)
      )
        return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = isDemoMode ? filtered.slice(page * pageSize, (page + 1) * pageSize) : filtered;

  const totalAssets: number = filtered.reduce((sum, row) => sum + row.assets, 0);
  const openHold: IHoldRow | undefined = allRows.find((row) => row.id === openId);

  const rangeFrom = filtered.length === 0 ? 0 : page * pageSize + 1;
  const rangeTo = Math.min((page + 1) * pageSize, filtered.length);

  const scopeLabels: Record<string, string> = {
    asset: t("pages.legalHolds.scopes.asset"),
    work_order: t("pages.legalHolds.scopes.workOrder"),
    namespace: t("pages.legalHolds.scopes.namespace"),
    uploader_window: t("pages.legalHolds.scopes.uploaderWindow"),
  };

  // Stats derived from allRows (not filtered)
  const activeCount = allRows.filter((row) => row.active).length;
  const totalAssetsAll = allRows.reduce((sum, row) => sum + row.assets, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-[22px] font-bold tracking-tight">
            {t("pages.legalHolds.title")}
          </h1>
          <div className="text-muted-foreground mt-1 text-[12.5px]">
            {t("pages.legalHolds.subtitle", {
              filtered: filtered.length,
              assets: totalAssets.toLocaleString(),
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="indigo">
            <Link to="/legal-holds/new">
              <Plus size={BTN_ICON_SIZE} />
              {t("pages.legalHolds.actions.placeNew")}
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Card className="px-4 py-3">
          <div className="text-muted-foreground text-[10.5px] tracking-wider uppercase">
            {t("pages.legalHolds.stats.activeHolds.label")}
          </div>
          <div className="mt-0.5 font-mono text-[24px] leading-tight tabular-nums">
            {activeCount}
          </div>
          <div className="text-muted-foreground text-[11px]">
            {t("pages.legalHolds.stats.activeHolds.sub")}
          </div>
        </Card>
        <Card className="px-4 py-3">
          <div className="text-muted-foreground text-[10.5px] tracking-wider uppercase">
            {t("pages.legalHolds.stats.assetsUnderHold.label")}
          </div>
          <div className="mt-0.5 font-mono text-[24px] leading-tight tabular-nums">
            {totalAssetsAll.toLocaleString()}
          </div>
          <div className="text-muted-foreground text-[11px]">
            {t("pages.legalHolds.stats.assetsUnderHold.sub")}
          </div>
        </Card>
        <Card className="px-4 py-3">
          <div className="text-muted-foreground text-[10.5px] tracking-wider uppercase">
            {t("pages.legalHolds.stats.oldestHold.label")}
          </div>
          <div className="mt-0.5 font-mono text-[24px] leading-tight tabular-nums">—</div>
          <div className="text-muted-foreground text-[11px]">
            {t("pages.legalHolds.stats.oldestHold.sub")}
          </div>
        </Card>
      </div>

      {/* Filter card */}
      <Card className="mb-4 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[260px] flex-1">
            <Search
              size={SEARCH_ICON_SIZE}
              className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2"
            />
            <input
              type="text"
              placeholder={t("pages.legalHolds.searchPlaceholder")}
              value={query}
              onChange={(ev: React.ChangeEvent<HTMLInputElement>) => {
                setQuery(ev.target.value);
                setPage(0);
              }}
              className="border-input bg-card focus:ring-ring h-9 w-full rounded-md border pr-3 pl-9 text-[12.5px] outline-none focus:ring-1"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(ev: React.ChangeEvent<HTMLSelectElement>) => {
              setStatusFilter(ev.target.value);
              setPage(0);
            }}
            className={SELECT_CLASS}
          >
            <option value="all">{t("pages.legalHolds.filters.allStatuses")}</option>
            <option value="active">{t("pages.legalHolds.statuses.active")}</option>
            <option value="lifted">{t("pages.legalHolds.statuses.pendingRelease")}</option>
          </select>
        </div>
      </Card>

      {/* Table card */}
      <Card className="overflow-x-auto">
        <div className="min-w-[1080px]">
          <div
            className={cn(
              "border-border bg-secondary/40 text-muted-foreground grid items-center gap-3 border-b px-4 py-2 text-[10.5px] font-medium tracking-wider uppercase",
              TABLE_COLS,
            )}
          >
            <span>{t("pages.legalHolds.table.caseRef")}</span>
            <span>{t("pages.legalHolds.table.scope")}</span>
            <span>{t("pages.legalHolds.table.target")}</span>
            <span className="text-right">{t("pages.legalHolds.table.assets")}</span>
            <span>{t("pages.legalHolds.table.placedBy")}</span>
            <span>{t("pages.legalHolds.table.lastReviewed")}</span>
            <span>{t("pages.legalHolds.table.status")}</span>
            <span />
          </div>
          {pageRows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => {
                setOpenId(row.id);
              }}
              className={cn(
                "border-border/40 hover:bg-secondary/30 grid w-full items-center gap-3 border-b px-4 py-2.5 text-left text-[12.5px] last:border-b-0",
                TABLE_COLS,
              )}
            >
              <div className="min-w-0">
                <div className="text-latam-indigo-deep truncate font-mono text-[12.5px]">
                  {row.caseRef}
                </div>
                <div className="text-muted-foreground truncate font-mono text-[10.5px]">
                  {row.id}
                </div>
              </div>
              <div
                className={cn(
                  "border-border bg-secondary/40 inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px]",
                )}
              >
                <ScopeIcon scope={row.scope} />
                {scopeLabels[row.scope] ?? row.scopeLabel}
              </div>
              <div className="text-muted-foreground truncate font-mono text-[11.5px]">
                {row.scopeLabel}
              </div>
              <div className="text-right font-mono text-[12.5px] tabular-nums">
                {row.assets.toLocaleString()}
              </div>
              <div className="text-muted-foreground truncate font-mono text-[11.5px]">
                {row.placedBy}
              </div>
              <div className="text-muted-foreground text-[11.5px]">
                {row.lastReviewed.slice(0, DATE_SLICE_END)}
              </div>
              <div>
                {row.active ? (
                  <Badge variant="warn">
                    <Lock size={BADGE_ICON_SIZE} />
                    {t("pages.legalHolds.statuses.active")}
                  </Badge>
                ) : (
                  <Badge variant="info">
                    <Clock size={BADGE_ICON_SIZE} />
                    {t("pages.legalHolds.statuses.pendingRelease")}
                  </Badge>
                )}
              </div>
              <ChevronRight size={CHEVRON_SIZE} className="text-muted-foreground" />
            </button>
          ))}
        </div>
      </Card>

      {/* Footer paginator */}
      <div className="text-muted-foreground mt-3 flex flex-wrap items-center justify-between gap-3 text-[11.5px]">
        <div className="flex items-center gap-2">
          <span>{t("paginator.rowsPerPage")}</span>
          <select
            value={pageSize}
            onChange={(ev: React.ChangeEvent<HTMLSelectElement>) => {
              setPageSize(Number(ev.target.value));
              setPage(0);
            }}
            className={SELECT_CLASS_SM}
            aria-label={t("paginator.rowsPerPage")}
          >
            {PAGE_SIZE_OPTIONS.map((pageOpt) => (
              <option key={pageOpt} value={pageOpt}>
                {pageOpt}
              </option>
            ))}
          </select>
          {filtered.length > 0 && (
            <>
              <span className="hidden sm:inline">·</span>
              <span className="hidden font-mono tabular-nums sm:inline">
                {t("paginator.range", {
                  from: rangeFrom.toLocaleString(),
                  to: rangeTo.toLocaleString(),
                  total: filtered.length.toLocaleString(),
                })}
              </span>
            </>
          )}
        </div>
        <Paginator
          page={page}
          totalPages={totalPages}
          onChange={(newPage) => {
            setPage(newPage);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      </div>

      {/* Footer note */}
      <div className="text-muted-foreground mt-4 text-[11.5px]">{t("pages.legalHolds.footer")}</div>

      {/* Detail drawer */}
      {openHold !== undefined && (
        <HoldDrawer
          hold={openHold}
          onClose={() => {
            setOpenId(null);
          }}
          onLift={() => {
            setLiftDialogOpen(true);
          }}
        />
      )}

      {/* Lift dialog — rendered outside the drawer so it is not nested in a focus trap */}
      {openHold !== undefined && (
        <LiftLegalHoldDialog
          open={liftDialogOpen}
          holdId={openHold.id}
          caseReference={openHold.caseRef}
          onClose={() => {
            setLiftDialogOpen(false);
          }}
        />
      )}
    </div>
  );
}
