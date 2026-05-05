import { AssetImage } from "@lafken/react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Image, LayoutGrid, Lock, Shield, Sliders } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/common/Card";
import { StatePill } from "@/components/common/StatePill";
import type { IAssetRow } from "@/features/assets/asset-row";
import { cn } from "@/lib/utils";

export type ViewMode = "rows" | "hybrid" | "grid";

const AUTO_PAGE_SIZE_GRID = 24;
const AUTO_PAGE_SIZE_HYBRID = 16;
const AUTO_PAGE_SIZE_ROWS = 18;

export function getAutoPageSize(view: ViewMode): number {
  if (view === "grid") return AUTO_PAGE_SIZE_GRID;
  if (view === "hybrid") return AUTO_PAGE_SIZE_HYBRID;
  return AUTO_PAGE_SIZE_ROWS;
}

// Size display thresholds and units
const BYTES_PER_KIB = 1024;
export const BYTES_PER_MIB = 1_048_576;
const KB_DISPLAY_THRESHOLD = BYTES_PER_MIB;

function formatSize(bytes: number): string {
  if (bytes <= 0) return "—";
  if (bytes < KB_DISPLAY_THRESHOLD) {
    return `${(bytes / BYTES_PER_KIB).toFixed(0)} KB`;
  }
  return `${(bytes / BYTES_PER_MIB).toFixed(1)} MB`;
}

// ── Thumbnail ─────────────────────────────────────────────────────────────
type ThumbSize = "sm" | "md" | "lg";

const THUMB_DIMS: Record<ThumbSize, string> = {
  sm: "h-9 w-12",
  md: "h-14 w-20",
  lg: "h-32 w-full",
};

const THUMB_SHIELD_SM = 12;
const THUMB_SHIELD_MD = 16;

interface IThumbProps {
  asset: IAssetRow;
  size?: ThumbSize;
}

function Thumb({ asset, size = "md" }: IThumbProps): React.JSX.Element {
  const isQuarantined =
    asset.state === "quarantined_moderation" || asset.state === "quarantined_virus";
  // Hide the bytes for states whose contents shouldn't be exposed; the BE
  // already returns an empty previewUrls map for those, but defend anyway.
  const sdkAsset =
    isQuarantined || asset.state === "rejected" ? null : { previewUrls: asset.previewUrls };
  return (
    <div
      className={cn("border-border relative overflow-hidden rounded border", THUMB_DIMS[size])}
      style={{
        background: `linear-gradient(135deg, hsl(${asset.thumbHue} 50% 55%), hsl(${asset.thumbHue} 60% 35%))`,
      }}
    >
      <AssetImage
        asset={sdkAsset}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* Static processing scan stripe (no animation per React port spec) */}
      {asset.state === "processing" && (
        <span className="absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.18)_0_4px,transparent_4px_8px)]" />
      )}
      {/* Quarantine hazard stripe */}
      {isQuarantined && (
        <span className="absolute inset-0 grid place-items-center bg-[repeating-linear-gradient(45deg,rgba(138,66,9,0.85)_0_8px,rgba(138,66,9,0.7)_8px_16px)] text-[10px] font-bold tracking-wider text-white uppercase">
          <Shield size={size === "sm" ? THUMB_SHIELD_SM : THUMB_SHIELD_MD} />
        </span>
      )}
      {/* Tail chip — only when present (demo data) */}
      {size !== "sm" && asset.tail !== "" && (
        <span className="absolute bottom-1 left-1 rounded-sm bg-black/45 px-1 font-mono text-[9.5px] tracking-wider text-white uppercase">
          {asset.tail}
        </span>
      )}
    </div>
  );
}

// ── fmtMinAgo (local copy so the view is independent of demo helpers) ─────
const MIN_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

function fmtMinAgo(minutes: number): string {
  if (minutes < MIN_PER_HOUR) return `${minutes}m`;
  const hours = Math.floor(minutes / MIN_PER_HOUR);
  if (hours < HOURS_PER_DAY) return `${hours}h`;
  const days = Math.floor(hours / HOURS_PER_DAY);
  return `${days}d`;
}

// ── Rows view ─────────────────────────────────────────────────────────────
const ROWS_COLS =
  "grid-cols-[34px_60px_minmax(0,1.6fr)_minmax(0,1.2fr)_120px_120px_minmax(0,1.4fr)_85px_60px_34px]";

interface IRowsViewProps {
  pageRows: IAssetRow[];
  selected: Set<string>;
  onToggleOne: (rowKey: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  hideSelection: boolean;
}

function RowsView({
  pageRows,
  selected,
  onToggleOne,
  onToggleAll,
  hideSelection,
}: IRowsViewProps): React.JSX.Element {
  const { t } = useTranslation();
  const allChecked = pageRows.length > 0 && pageRows.every((row) => selected.has(row.rowKey));
  return (
    <Card className="overflow-x-auto">
      <div className="min-w-[1080px]">
        {/* Header row */}
        <div
          className={cn(
            "border-border bg-secondary/40 text-muted-foreground grid items-center gap-3 border-b px-4 py-2 text-[10.5px] font-medium tracking-wider uppercase",
            ROWS_COLS,
          )}
        >
          {hideSelection ? (
            <span />
          ) : (
            <input
              type="checkbox"
              checked={allChecked}
              onChange={(e) => {
                onToggleAll(e.target.checked);
              }}
              className="accent-latam-indigo"
              aria-label={t("pages.assets.table.selectAll")}
            />
          )}
          <span />
          <span>{t("pages.assets.table.asset")}</span>
          <span>{t("pages.assets.table.namespaceWo")}</span>
          <span>{t("pages.assets.table.state")}</span>
          <span>{t("pages.assets.table.formatDimensions")}</span>
          <span>{t("pages.assets.table.uploadedBy")}</span>
          <span className="text-right">{t("pages.assets.table.size")}</span>
          <span className="text-right">{t("pages.assets.table.age")}</span>
          <span />
        </div>
        {/* Data rows */}
        {pageRows.map((asset) => (
          <Link
            key={asset.rowKey}
            to="/assets/$publicId"
            params={{ publicId: asset.publicId }}
            className={cn(
              "border-border/40 hover:bg-secondary/30 grid items-center gap-3 border-b px-4 py-2 text-[12.5px] no-underline last:border-b-0",
              ROWS_COLS,
            )}
          >
            {hideSelection ? (
              <span />
            ) : (
              <input
                type="checkbox"
                checked={selected.has(asset.rowKey)}
                onChange={(e) => {
                  e.stopPropagation();
                  onToggleOne(asset.rowKey, e.target.checked);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                }}
                className="accent-latam-indigo"
                aria-label={asset.shortId}
              />
            )}
            <Thumb asset={asset} size="sm" />
            <div className="min-w-0">
              <div className="text-foreground font-mono text-[12px]">{asset.shortId}…</div>
              {asset.legalHold && (
                <span className="text-warn mt-0.5 inline-flex items-center gap-1 text-[10px]">
                  <Lock size={10} /> {t("pages.assets.row.hold")}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-latam-indigo-deep truncate font-mono text-[11.5px]">
                {asset.namespaceSlug}
              </div>
              {asset.wo !== "" && (
                <div className="text-muted-foreground truncate font-mono text-[10.5px]">
                  {asset.wo}
                </div>
              )}
            </div>
            <StatePill state={asset.state} />
            <div className="min-w-0">
              <div className="font-mono text-[11.5px] tracking-wider uppercase">{asset.format}</div>
              {asset.dimensions !== "" && (
                <div className="text-muted-foreground font-mono text-[10.5px] tabular-nums">
                  {asset.dimensions}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[12px]">{asset.uploadedDisplay}</div>
              <div className="text-muted-foreground truncate font-mono text-[10.5px]">
                {asset.uploadedBy}
              </div>
            </div>
            <div className="text-muted-foreground text-right font-mono text-[11.5px] tabular-nums">
              {formatSize(asset.sizeBytes)}
            </div>
            <div className="text-muted-foreground text-right font-mono text-[11.5px] tabular-nums">
              {fmtMinAgo(asset.minutesAgo)}
            </div>
            <ChevronRight size={12} className="text-muted-foreground" />
          </Link>
        ))}
      </div>
    </Card>
  );
}

// ── Grid view ─────────────────────────────────────────────────────────────
interface IGridViewProps {
  pageRows: IAssetRow[];
}

function GridView({ pageRows }: IGridViewProps): React.JSX.Element {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
      {pageRows.map((asset) => (
        <Link
          key={asset.rowKey}
          to="/assets/$publicId"
          params={{ publicId: asset.publicId }}
          className="group border-border bg-card hover:border-latam-indigo/30 block overflow-hidden rounded-md border no-underline transition-all hover:shadow-md"
        >
          <div className="relative">
            <Thumb asset={asset} size="lg" />
            <span className="absolute top-1.5 right-1.5">
              <StatePill state={asset.state} />
            </span>
          </div>
          <div className="border-border border-t px-3 py-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-foreground font-mono text-[11.5px]">{asset.shortId}…</span>
              <span className="text-muted-foreground font-mono text-[10.5px]">
                {fmtMinAgo(asset.minutesAgo)}
              </span>
            </div>
            <div className="mt-1 truncate font-mono text-[11.5px] tracking-wider uppercase">
              {asset.format}
              {asset.dimensions !== "" && (
                <span className="text-muted-foreground"> · {asset.dimensions}</span>
              )}
            </div>
            <div className="mt-0.5 flex items-center justify-between text-[10.5px]">
              <span className="text-muted-foreground font-mono">{asset.namespaceSlug}</span>
              <span className="text-muted-foreground font-mono tabular-nums">
                {formatSize(asset.sizeBytes)}
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ── Hybrid view ───────────────────────────────────────────────────────────
interface IHybridViewProps {
  pageRows: IAssetRow[];
}

function HybridView({ pageRows }: IHybridViewProps): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {pageRows.map((asset) => (
        <Link
          key={asset.rowKey}
          to="/assets/$publicId"
          params={{ publicId: asset.publicId }}
          className="border-border bg-card hover:border-latam-indigo/30 flex gap-3 overflow-hidden rounded-md border p-2.5 no-underline transition-all hover:shadow-sm"
        >
          <div className="flex-none">
            <Thumb asset={asset} size="md" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-foreground font-mono text-[12px]">{asset.shortId}…</span>
              <StatePill state={asset.state} />
            </div>
            <div className="mt-1 truncate font-mono text-[12px] tracking-wider uppercase">
              {asset.format}
              {asset.dimensions !== "" && (
                <span className="text-muted-foreground"> · {asset.dimensions}</span>
              )}
            </div>
            <div className="text-muted-foreground mt-1 flex items-center justify-between text-[11px]">
              <span className="font-mono">{asset.namespaceSlug}</span>
              <span>{fmtMinAgo(asset.minutesAgo)}</span>
            </div>
            <div className="text-muted-foreground mt-0.5 flex items-center justify-between text-[10.5px]">
              <span className="truncate">{asset.uploadedDisplay}</span>
              <span className="font-mono">{formatSize(asset.sizeBytes)}</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ── ViewToggle ────────────────────────────────────────────────────────────
interface IViewToggleProps {
  view: ViewMode;
  onChange: (v: ViewMode) => void;
}

export function ViewToggle({ view, onChange }: IViewToggleProps): React.JSX.Element {
  const { t } = useTranslation();
  const opts: Array<{ id: ViewMode; label: string; icon: React.ReactNode }> = [
    { id: "rows", label: t("pages.assets.viewToggle.rows"), icon: <Sliders size={13} /> },
    { id: "hybrid", label: t("pages.assets.viewToggle.hybrid"), icon: <Image size={13} /> },
    { id: "grid", label: t("pages.assets.viewToggle.grid"), icon: <LayoutGrid size={13} /> },
  ];
  return (
    <div className="border-border bg-card inline-flex rounded-md border p-0.5 text-[12px]">
      {opts.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => {
            onChange(opt.id);
          }}
          className={cn(
            "inline-flex items-center gap-1.5 rounded px-2.5 py-1 transition-colors",
            view === opt.id
              ? "bg-latam-indigo text-white"
              : "text-muted-foreground hover:text-foreground",
          )}
          aria-pressed={view === opt.id}
        >
          {opt.icon} {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── Public AssetsListView ─────────────────────────────────────────────────
export interface IAssetsListViewProps {
  rows: IAssetRow[];
  view: ViewMode;
  selected: Set<string>;
  onToggleOne: (rowKey: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  /** When true, hide the per-row checkbox and the "all" checkbox. */
  hideSelection?: boolean;
}

export function AssetsListView({
  rows,
  view,
  selected,
  onToggleOne,
  onToggleAll,
  hideSelection = false,
}: IAssetsListViewProps): React.JSX.Element {
  if (view === "grid") {
    return <GridView pageRows={rows} />;
  }
  if (view === "hybrid") {
    return <HybridView pageRows={rows} />;
  }
  return (
    <RowsView
      pageRows={rows}
      selected={selected}
      onToggleOne={onToggleOne}
      onToggleAll={onToggleAll}
      hideSelection={hideSelection}
    />
  );
}
