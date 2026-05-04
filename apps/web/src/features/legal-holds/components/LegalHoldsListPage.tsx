import {
  Check,
  ChevronRight,
  Clock,
  Download,
  Eye,
  Globe,
  Image,
  Layers,
  Lock,
  Plus,
  Search,
  Tag,
  X,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { Label } from "@/components/common/Label";
import { DEMO_LEGAL_HOLDS } from "@/lib/demo/lafken-demo-data";
import type { DemoLegalHold } from "@/lib/demo/lafken-demo-data";
import { cn } from "@/lib/utils";

// Slice 0: BE returns empty arrays; rendering against typed demo data

// Icon sizes
const SCOPE_ICON_DEFAULT_SIZE = 12;
const BADGE_ICON_SIZE = 10;
const BTN_ICON_SIZE = 13;
const CHEVRON_SIZE = 12;
const X_ICON_SIZE = 16;
const CHECK_ICON_SIZE = 12;
const SEARCH_ICON_SIZE = 13;

// Date slice: first 10 chars = YYYY-MM-DD
const DATE_SLICE_END = 10;

const SELECT_CLASS =
  "h-9 appearance-none rounded-md border border-input bg-card pl-3 pr-8 text-[12.5px]";

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

interface IHoldDrawerProps {
  hold: DemoLegalHold;
  onClose: () => void;
}

function HoldDrawer({ hold, onClose }: IHoldDrawerProps): React.JSX.Element {
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
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- backdrop dismiss is supplemental; close button handles keyboard
    <div
      className="bg-foreground/30 fixed inset-0 z-40 flex justify-end backdrop-blur-sm"
      onClick={onClose}
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- stopPropagation inside dialog panel; close button + Escape handle keyboard */}
      <div
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="bg-card flex h-full w-full max-w-[520px] flex-col overflow-y-auto shadow-2xl"
        onKeyDown={(ev: React.KeyboardEvent) => {
          if (ev.key === "Escape") {
            onClose();
          }
        }}
        onClick={(ev: React.MouseEvent) => {
          ev.stopPropagation();
        }}
      >
        {/* Sticky header */}
        <div className="border-border bg-card sticky top-0 flex items-center justify-between border-b px-5 py-3">
          <div>
            <div className="text-muted-foreground text-[10.5px] tracking-wider uppercase">
              {t("pages.legalHolds.drawer.caption")}
            </div>
            <div className="font-mono text-[14px] font-semibold">{hold.caseRef}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label={t("pages.legalHolds.drawer.close")}
          >
            <X size={X_ICON_SIZE} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 px-5 py-5">
          <div>
            <Label>{t("pages.legalHolds.drawer.holdId")}</Label>
            <div className="mt-0.5 font-mono text-[12.5px]">{hold.id}</div>
          </div>

          <div>
            <Label>{t("pages.legalHolds.drawer.scope")}</Label>
            <div className="border-border bg-secondary/50 mt-1 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px]">
              <ScopeIcon scope={hold.scope} />
              {scopeLabels[hold.scope] ?? hold.scope}
            </div>
            <div className="text-muted-foreground mt-1.5 font-mono text-[12px]">
              {hold.scopeLabel}
            </div>
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
                {hold.status === "active" ? (
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
              {activities.map((activity, idx) => (
                <div
                  key={idx}
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

        {/* Sticky footer */}
        <div className="border-border bg-card sticky bottom-0 flex justify-end gap-2 border-t px-5 py-3">
          <Button variant="outline">
            <Eye size={BTN_ICON_SIZE} />
            {t("pages.legalHolds.drawer.actions.viewAssets")}
          </Button>
          <Button variant="outline">
            <Download size={BTN_ICON_SIZE} />
            {t("pages.legalHolds.drawer.actions.export")}
          </Button>
          <Button variant="danger">
            <Lock size={BTN_ICON_SIZE} />
            {t("pages.legalHolds.drawer.actions.requestLift")}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Slice 0: oldest-hold stat — derived from demo data, not hardcoded.
// Computed once at module load so Date.now() is stable across renders.
const MS_PER_DAY = 86_400_000;
const _oldestHold = DEMO_LEGAL_HOLDS.slice().sort((a, b) =>
  a.placedAt.localeCompare(b.placedAt),
)[0];
const OLDEST_HOLD_STAT: { days: number; caseRef: string } =
  _oldestHold === undefined
    ? { days: 0, caseRef: "" }
    : {
        days: Math.floor((Date.now() - new Date(_oldestHold.placedAt).getTime()) / MS_PER_DAY),
        caseRef: _oldestHold.caseRef,
      };

export function LegalHoldsListPage(): React.JSX.Element {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered: DemoLegalHold[] = DEMO_LEGAL_HOLDS.filter((hold) => {
    if (statusFilter !== "all" && hold.status !== statusFilter) return false;
    if (scopeFilter !== "all" && hold.scope !== scopeFilter) return false;
    if (query) {
      const lq = query.toLowerCase();
      if (
        !hold.caseRef.toLowerCase().includes(lq) &&
        !hold.scopeLabel.toLowerCase().includes(lq) &&
        !hold.id.toLowerCase().includes(lq)
      )
        return false;
    }
    return true;
  });

  const totalAssets: number = filtered.reduce((sum, hold) => sum + hold.assets, 0);
  const openHold: DemoLegalHold | undefined = DEMO_LEGAL_HOLDS.find((hold) => hold.id === openId);

  const scopeLabels: Record<string, string> = {
    asset: t("pages.legalHolds.scopes.asset"),
    work_order: t("pages.legalHolds.scopes.workOrder"),
    namespace: t("pages.legalHolds.scopes.namespace"),
    uploader_window: t("pages.legalHolds.scopes.uploaderWindow"),
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-[22px] font-bold tracking-tight">
            {t("pages.legalHolds.title")}
          </h1>
          <div className="text-muted-foreground mt-1 text-[12.5px]">
            <b className="text-foreground">{filtered.length}</b>{" "}
            {t("pages.legalHolds.subtitle", {
              filtered: filtered.length,
              assets: totalAssets.toLocaleString(),
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Download size={BTN_ICON_SIZE} />
            {t("pages.legalHolds.actions.export")}
          </Button>
          <Button variant="indigo">
            <Plus size={BTN_ICON_SIZE} />
            {t("pages.legalHolds.actions.place")}
          </Button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="px-4 py-3">
          <div className="text-muted-foreground text-[10.5px] tracking-wider uppercase">
            {t("pages.legalHolds.stats.activeHolds.label")}
          </div>
          <div className="mt-0.5 font-mono text-[24px] leading-tight tabular-nums">
            {DEMO_LEGAL_HOLDS.filter((hold) => hold.status === "active").length}
          </div>
          <div className="text-muted-foreground text-[11px]">
            {t("pages.legalHolds.stats.activeHolds.sub")}
          </div>
        </Card>
        <Card className="px-4 py-3">
          <div className="text-muted-foreground text-[10.5px] tracking-wider uppercase">
            {t("pages.legalHolds.stats.pendingRelease.label")}
          </div>
          <div className="text-warn mt-0.5 font-mono text-[24px] leading-tight tabular-nums">
            {DEMO_LEGAL_HOLDS.filter((hold) => hold.status === "pending_release").length}
          </div>
          <div className="text-muted-foreground text-[11px]">
            {t("pages.legalHolds.stats.pendingRelease.sub")}
          </div>
        </Card>
        <Card className="px-4 py-3">
          <div className="text-muted-foreground text-[10.5px] tracking-wider uppercase">
            {t("pages.legalHolds.stats.assetsUnderHold.label")}
          </div>
          <div className="mt-0.5 font-mono text-[24px] leading-tight tabular-nums">
            {DEMO_LEGAL_HOLDS.reduce((sum, hold) => sum + hold.assets, 0).toLocaleString()}
          </div>
          <div className="text-muted-foreground text-[11px]">
            {t("pages.legalHolds.stats.assetsUnderHold.sub")}
          </div>
        </Card>
        <Card className="px-4 py-3">
          <div className="text-muted-foreground text-[10.5px] tracking-wider uppercase">
            {t("pages.legalHolds.stats.oldestHold.label")}
          </div>
          <div className="mt-0.5 font-mono text-[24px] leading-tight tabular-nums">
            {OLDEST_HOLD_STAT.days}d
          </div>
          <div className="text-muted-foreground text-[11px]">{OLDEST_HOLD_STAT.caseRef}</div>
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
              }}
              className="border-input bg-card focus:ring-ring h-9 w-full rounded-md border pr-3 pl-9 text-[12.5px] outline-none focus:ring-1"
            />
          </div>
          <select
            value={scopeFilter}
            onChange={(ev: React.ChangeEvent<HTMLSelectElement>) => {
              setScopeFilter(ev.target.value);
            }}
            className={SELECT_CLASS}
          >
            <option value="all">{t("pages.legalHolds.filters.allScopes")}</option>
            <option value="asset">{t("pages.legalHolds.scopes.asset")}</option>
            <option value="work_order">{t("pages.legalHolds.scopes.workOrder")}</option>
            <option value="namespace">{t("pages.legalHolds.scopes.namespace")}</option>
            <option value="uploader_window">{t("pages.legalHolds.scopes.uploaderWindow")}</option>
          </select>
          <select
            value={statusFilter}
            onChange={(ev: React.ChangeEvent<HTMLSelectElement>) => {
              setStatusFilter(ev.target.value);
            }}
            className={SELECT_CLASS}
          >
            <option value="all">{t("pages.legalHolds.filters.allStatuses")}</option>
            <option value="active">{t("pages.legalHolds.statuses.active")}</option>
            <option value="pending_release">{t("pages.legalHolds.statuses.pendingRelease")}</option>
          </select>
        </div>
      </Card>

      {/* Table card */}
      <Card className="overflow-x-auto">
        <div className="min-w-[1080px]">
          <div className="border-border bg-secondary/40 text-muted-foreground grid grid-cols-[minmax(0,1.4fr)_120px_minmax(0,2fr)_85px_minmax(0,1.2fr)_110px_120px_34px] items-center gap-3 border-b px-4 py-2 text-[10.5px] font-medium tracking-wider uppercase">
            <span>{t("pages.legalHolds.table.caseRef")}</span>
            <span>{t("pages.legalHolds.table.scope")}</span>
            <span>{t("pages.legalHolds.table.target")}</span>
            <span className="text-right">{t("pages.legalHolds.table.assets")}</span>
            <span>{t("pages.legalHolds.table.placedBy")}</span>
            <span>{t("pages.legalHolds.table.lastReviewed")}</span>
            <span>{t("pages.legalHolds.table.status")}</span>
            <span />
          </div>
          {filtered.map((hold) => (
            <button
              key={hold.id}
              type="button"
              onClick={() => {
                setOpenId(hold.id);
              }}
              className="border-border/40 hover:bg-secondary/30 grid w-full grid-cols-[minmax(0,1.4fr)_120px_minmax(0,2fr)_85px_minmax(0,1.2fr)_110px_120px_34px] items-center gap-3 border-b px-4 py-2.5 text-left text-[12.5px] last:border-b-0"
            >
              <div className="min-w-0">
                <div className="text-latam-indigo-deep truncate font-mono text-[12.5px]">
                  {hold.caseRef}
                </div>
                <div className="text-muted-foreground truncate font-mono text-[10.5px]">
                  {hold.id}
                </div>
              </div>
              <div
                className={cn(
                  "border-border bg-secondary/40 inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px]",
                )}
              >
                <ScopeIcon scope={hold.scope} />
                {scopeLabels[hold.scope] ?? hold.scope}
              </div>
              <div className="text-muted-foreground truncate font-mono text-[11.5px]">
                {hold.scopeLabel}
              </div>
              <div className="text-right font-mono text-[12.5px] tabular-nums">
                {hold.assets.toLocaleString()}
              </div>
              <div className="text-muted-foreground truncate font-mono text-[11.5px]">
                {hold.placedBy}
              </div>
              <div className="text-muted-foreground text-[11.5px]">
                {hold.lastReviewed.slice(0, DATE_SLICE_END)}
              </div>
              <div>
                {hold.status === "active" ? (
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

      {/* Footer */}
      <div className="text-muted-foreground mt-3 text-[11.5px]">{t("pages.legalHolds.footer")}</div>

      {/* Detail drawer */}
      {openHold !== undefined && (
        <HoldDrawer
          hold={openHold}
          onClose={() => {
            setOpenId(null);
          }}
        />
      )}
    </div>
  );
}
