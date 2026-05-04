import { Link } from "@tanstack/react-router";
import {
  ChevronRight,
  Download,
  Filter,
  Image,
  LayoutGrid,
  Lock,
  Plus,
  Search,
  Shield,
  Sliders,
  Tag,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { Paginator } from "@/components/common/Paginator";
import { SELECT_CLASS, SELECT_CLASS_SM } from "@/components/common/select-styles";
import { StatePill } from "@/components/common/StatePill";
import { DEMO_ASSET_LIST, DEMO_NAMESPACES, fmtMinAgo } from "@/lib/demo/lafken-demo-data";
import type { DemoAsset } from "@/lib/demo/lafken-demo-data";
import { cn } from "@/lib/utils";

// ── View-mode constants ───────────────────────────────────────────────────
type ViewMode = "rows" | "hybrid" | "grid";

const AUTO_PAGE_SIZE_GRID = 24;
const AUTO_PAGE_SIZE_HYBRID = 16;
const AUTO_PAGE_SIZE_ROWS = 18;

function getAutoPageSize(view: ViewMode): number {
  if (view === "grid") return AUTO_PAGE_SIZE_GRID;
  if (view === "hybrid") return AUTO_PAGE_SIZE_HYBRID;
  return AUTO_PAGE_SIZE_ROWS;
}

// Page-size options for the rows-per-page selector
/* eslint-disable no-magic-numbers */
const PAGE_SIZE_OPTIONS = [18, 24, 50, 100, 200] as const;
/* eslint-enable no-magic-numbers */

// ── Thumbnail ─────────────────────────────────────────────────────────────
type ThumbSize = "sm" | "md" | "lg";

const THUMB_DIMS: Record<ThumbSize, string> = {
  sm: "h-9 w-12",
  md: "h-14 w-20",
  lg: "h-32 w-full",
};

// Shield icon sizes for thumbnails
const THUMB_SHIELD_SM = 12;
const THUMB_SHIELD_MD = 16;

// 1024 * 1024 — bytes per mebibyte for size display
const BYTES_PER_MIB = 1_048_576;

interface IThumbProps {
  asset: DemoAsset;
  size?: ThumbSize;
}

function Thumb({ asset, size = "md" }: IThumbProps) {
  const isQuarantined =
    asset.state === "quarantined_moderation" || asset.state === "quarantined_virus";
  return (
    <div
      className={cn("border-border relative overflow-hidden rounded border", THUMB_DIMS[size])}
      style={{
        background: `linear-gradient(135deg, hsl(${asset.thumbHue} 50% 55%), hsl(${asset.thumbHue} 60% 35%))`,
      }}
    >
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
      {/* Tail chip */}
      {size !== "sm" && (
        <span className="absolute bottom-1 left-1 rounded-sm bg-black/45 px-1 font-mono text-[9.5px] tracking-wider text-white uppercase">
          {asset.tail}
        </span>
      )}
    </div>
  );
}

// ── Rows view ─────────────────────────────────────────────────────────────
const ROWS_COLS =
  "grid-cols-[34px_60px_minmax(0,1.6fr)_minmax(0,1.2fr)_120px_120px_minmax(0,1.4fr)_85px_60px_34px]";

interface IRowsViewProps {
  pageRows: DemoAsset[];
  selected: Set<string>;
  onToggleOne: (id: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
}

function RowsView({ pageRows, selected, onToggleOne, onToggleAll }: IRowsViewProps) {
  const { t } = useTranslation();
  const allChecked = pageRows.length > 0 && pageRows.every((row) => selected.has(row.id));
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
          <input
            type="checkbox"
            checked={allChecked}
            onChange={(e) => {
              onToggleAll(e.target.checked);
            }}
            className="accent-latam-indigo"
            aria-label={t("pages.assets.table.selectAll")}
          />
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
            key={asset.id}
            to="/assets/$publicId"
            params={{ publicId: asset.publicId }}
            className={cn(
              "border-border/40 hover:bg-secondary/30 grid items-center gap-3 border-b px-4 py-2 text-[12.5px] no-underline last:border-b-0",
              ROWS_COLS,
            )}
          >
            <input
              type="checkbox"
              checked={selected.has(asset.id)}
              onChange={(e) => {
                e.stopPropagation();
                onToggleOne(asset.id, e.target.checked);
              }}
              onClick={(e) => {
                e.stopPropagation();
              }}
              className="accent-latam-indigo"
              aria-label={asset.id}
            />
            <Thumb asset={asset} size="sm" />
            <div className="min-w-0">
              <div className="text-foreground font-mono text-[12px]">{asset.id}…</div>
              {asset.hasLegalHold && (
                <span className="text-warn mt-0.5 inline-flex items-center gap-1 text-[10px]">
                  <Lock size={10} /> {t("pages.assets.row.hold")}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-latam-indigo-deep truncate font-mono text-[11.5px]">
                {asset.namespace}
              </div>
              <div className="text-muted-foreground truncate font-mono text-[10.5px]">
                {asset.wo}
              </div>
            </div>
            <StatePill state={asset.state} />
            <div className="min-w-0">
              <div className="font-mono text-[11.5px] tracking-wider uppercase">{asset.format}</div>
              <div className="text-muted-foreground font-mono text-[10.5px] tabular-nums">
                {asset.dimensions}
              </div>
            </div>
            <div className="min-w-0">
              <div className="truncate text-[12px]">{asset.uploadedDisplay}</div>
              <div className="text-muted-foreground truncate font-mono text-[10.5px]">
                {asset.uploadedBy}
              </div>
            </div>
            <div className="text-muted-foreground text-right font-mono text-[11.5px] tabular-nums">
              {(asset.sizeBytes / BYTES_PER_MIB).toFixed(1)} MB
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
  pageRows: DemoAsset[];
}

function GridView({ pageRows }: IGridViewProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
      {pageRows.map((asset) => (
        <Link
          key={asset.id}
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
              <span className="text-foreground font-mono text-[11.5px]">{asset.id}…</span>
              <span className="text-muted-foreground font-mono text-[10.5px]">
                {fmtMinAgo(asset.minutesAgo)}
              </span>
            </div>
            <div className="mt-1 truncate font-mono text-[11.5px] tracking-wider uppercase">
              {asset.format} <span className="text-muted-foreground">· {asset.dimensions}</span>
            </div>
            <div className="mt-0.5 flex items-center justify-between text-[10.5px]">
              <span className="text-muted-foreground font-mono">{asset.namespace}</span>
              <span className="text-muted-foreground font-mono tabular-nums">
                {(asset.sizeBytes / BYTES_PER_MIB).toFixed(1)} MB
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
  pageRows: DemoAsset[];
}

function HybridView({ pageRows }: IHybridViewProps) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {pageRows.map((asset) => (
        <Link
          key={asset.id}
          to="/assets/$publicId"
          params={{ publicId: asset.publicId }}
          className="border-border bg-card hover:border-latam-indigo/30 flex gap-3 overflow-hidden rounded-md border p-2.5 no-underline transition-all hover:shadow-sm"
        >
          <div className="flex-none">
            <Thumb asset={asset} size="md" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-foreground font-mono text-[12px]">{asset.id}…</span>
              <StatePill state={asset.state} />
            </div>
            <div className="mt-1 truncate font-mono text-[12px] tracking-wider uppercase">
              {asset.format} <span className="text-muted-foreground">· {asset.dimensions}</span>
            </div>
            <div className="text-muted-foreground mt-1 flex items-center justify-between text-[11px]">
              <span className="font-mono">{asset.namespace}</span>
              <span>{fmtMinAgo(asset.minutesAgo)}</span>
            </div>
            <div className="text-muted-foreground mt-0.5 flex items-center justify-between text-[10.5px]">
              <span className="truncate">{asset.uploadedDisplay}</span>
              <span className="font-mono">{(asset.sizeBytes / BYTES_PER_MIB).toFixed(1)} MB</span>
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

function ViewToggle({ view, onChange }: IViewToggleProps) {
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

// ── Main page ─────────────────────────────────────────────────────────────
// Slice 0: BE returns empty arrays; rendering against typed demo data
const QUICK_FILTER_KEYS = [
  "last24h",
  "hasLegalHold",
  "quarantined",
  "failedPipelines",
  "mine",
] as const;

// Slice 1: wire to active more-filters count
const MORE_FILTERS_BADGE_PLACEHOLDER = 2;

export function AssetsListPage() {
  const { t } = useTranslation();

  const [view, setView] = useState<ViewMode>("rows");
  const [stateFilter, setStateFilter] = useState("all");
  const [namespaceFilter, setNamespaceFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(() => new Set<string>());
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(0); // 0 => use AUTO_PAGE_SIZE

  const autoPageSize = getAutoPageSize(view);
  const PAGE_SIZE = pageSize || autoPageSize;

  const filtered = useMemo(() => {
    // Slice 0: BE returns empty arrays; rendering against typed demo data
    return DEMO_ASSET_LIST.filter((asset) => {
      if (stateFilter !== "all" && asset.state !== stateFilter) return false;
      if (namespaceFilter !== "all" && asset.namespace !== namespaceFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        if (
          !asset.id.toLowerCase().includes(q) &&
          !asset.tail.toLowerCase().includes(q) &&
          !asset.wo.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [stateFilter, namespaceFilter, query]);

  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const hasActiveFilters = stateFilter !== "all" || namespaceFilter !== "all" || query !== "";

  function handleStateFilter(value: string): void {
    setStateFilter(value);
    setPage(0);
    setSelected(new Set());
  }

  function handleNamespaceFilter(value: string): void {
    setNamespaceFilter(value);
    setPage(0);
    setSelected(new Set());
  }

  function handleQuery(value: string): void {
    setQuery(value);
    setPage(0);
    setSelected(new Set());
  }

  function handleClearFilters(): void {
    setStateFilter("all");
    setNamespaceFilter("all");
    setQuery("");
    setPage(0);
    setSelected(new Set());
  }

  function handleToggleOne(id: string, checked: boolean): void {
    const next = new Set(selected);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    setSelected(next);
  }

  function handleToggleAll(checked: boolean): void {
    const next = new Set(selected);
    pageRows.forEach((row) => {
      if (checked) {
        next.add(row.id);
      } else {
        next.delete(row.id);
      }
    });
    setSelected(next);
  }

  function handleViewChange(nextView: ViewMode): void {
    setView(nextView);
    setPageSize(0);
  }

  function handlePageChange(newPage: number): void {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Range display values (1-indexed)
  const rangeFrom = filtered.length === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeTo = Math.min((page + 1) * PAGE_SIZE, filtered.length);

  return (
    <div className="space-y-4">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="mb-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="m-0 text-[22px] font-bold tracking-tight">{t("pages.assets.title")}</h1>
            <div className="text-muted-foreground mt-1 text-[12.5px]">
              {t("pages.assets.subtitle", {
                total: DEMO_ASSET_LIST.length.toLocaleString(),
                nsCount: DEMO_NAMESPACES.length,
              })}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ViewToggle view={view} onChange={handleViewChange} />
            <Button type="button" variant="outline">
              <Download /> {t("pages.assets.actions.export")}
            </Button>
            <Button type="button" variant="indigo">
              <Plus /> {t("pages.assets.actions.upload")}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Filter bar ─────────────────────────────────────── */}
      <Card className="mb-4 p-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative min-w-[260px] flex-1">
            <Search
              size={13}
              className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2"
            />
            <input
              type="search"
              placeholder={t("pages.assets.search.placeholder")}
              value={query}
              onChange={(e) => {
                handleQuery(e.target.value);
              }}
              className="border-input bg-card placeholder:text-muted-foreground focus:ring-ring h-9 w-full rounded-md border pr-3 pl-9 text-[12.5px] focus:ring-1 focus:outline-none"
              aria-label={t("pages.assets.search.placeholder")}
            />
          </div>

          {/* State filter */}
          <select
            value={stateFilter}
            onChange={(e) => {
              handleStateFilter(e.target.value);
            }}
            className={SELECT_CLASS}
            aria-label={t("pages.assets.filterByState")}
          >
            <option value="all">{t("pages.assets.filters.allStates")}</option>
            <option value="ready">{t("assetStates.ready")}</option>
            <option value="processing">{t("assetStates.processing")}</option>
            <option value="processing_failed">{t("assetStates.processing_failed")}</option>
            <option value="quarantined_moderation">
              {t("assetStates.quarantined_moderation")}
            </option>
            <option value="quarantined_virus">{t("assetStates.quarantined_virus")}</option>
            <option value="expired">{t("assetStates.expired")}</option>
          </select>

          {/* Namespace filter */}
          <select
            value={namespaceFilter}
            onChange={(e) => {
              handleNamespaceFilter(e.target.value);
            }}
            className={SELECT_CLASS}
            aria-label={t("pages.assets.filterByNamespace")}
          >
            <option value="all">{t("pages.assets.filters.allNamespaces")}</option>
            {DEMO_NAMESPACES.map((ns) => (
              <option key={ns.slug} value={ns.slug}>
                {ns.slug}
              </option>
            ))}
          </select>

          {/* More filters — matches the h-9 filter row, not the action-bar h-8 */}
          <button
            type="button"
            className="border-border bg-card hover:bg-secondary hover:border-latam-indigo/30 inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-[12.5px]"
          >
            <Filter size={13} /> {t("pages.assets.filters.moreFilters")}
            <span className="bg-secondary text-muted-foreground ml-1 rounded-full px-1.5 py-px text-[10.5px]">
              {MORE_FILTERS_BADGE_PLACEHOLDER}
            </span>
          </button>

          {/* Clear filters */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-latam-pink inline-flex h-9 items-center gap-1 rounded px-2 text-[12px] hover:underline"
            >
              <X size={11} /> {t("pages.assets.filters.clear")}
            </button>
          )}
        </div>

        {/* Quick filters strip */}
        <div className="border-border mt-2 flex flex-wrap items-center gap-1.5 border-t border-dashed pt-2 text-[11px]">
          <span className="text-muted-foreground self-center text-[10.5px] tracking-wider uppercase">
            {t("pages.assets.filters.quickFiltersLabel")}
          </span>
          {QUICK_FILTER_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className="border-border bg-card text-muted-foreground hover:border-latam-indigo/30 hover:text-foreground rounded-full border px-2.5 py-0.5 text-[11.5px]"
            >
              {t(`pages.assets.filters.quickFilters.${key}`)}
            </button>
          ))}
        </div>
      </Card>

      {/* ── Bulk action bar ─────────────────────────────────── */}
      {selected.size > 0 && (
        <div className="border-latam-indigo bg-latam-indigo sticky top-[52px] z-10 -mx-4 mb-4 border-b px-4 py-2 text-white sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="mx-auto flex max-w-[1480px] flex-wrap items-center gap-3">
            <span className="text-[12.5px] font-medium">
              {t("pages.assets.bulkBar.selected", { count: selected.size })}
            </span>
            <div className="ml-auto flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-white/30 bg-white/10 px-3 py-1 text-[12px] text-white hover:bg-white/20"
              >
                <Download size={13} /> {t("pages.assets.bulkBar.export")}
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-white/30 bg-white/10 px-3 py-1 text-[12px] text-white hover:bg-white/20"
              >
                <Lock size={13} /> {t("pages.assets.bulkBar.placeHold")}
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-white/30 bg-white/10 px-3 py-1 text-[12px] text-white hover:bg-white/20"
              >
                <Tag size={13} /> {t("pages.assets.bulkBar.editMetadata")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelected(new Set<string>());
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/30 bg-white/10 px-3 py-1 text-[12px] text-white hover:bg-white/20"
              >
                <X size={13} /> {t("pages.assets.bulkBar.clear")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Stats line ──────────────────────────────────────── */}
      <div className="text-muted-foreground mb-3 text-[12px]">
        {filtered.length === 0
          ? t("pages.assets.summaryEmpty")
          : t("pages.assets.summaryRange", {
              from: rangeFrom.toLocaleString(),
              to: rangeTo.toLocaleString(),
              total: filtered.length.toLocaleString(),
            })}
      </div>

      {/* ── Content area ──────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <Card className="px-8 py-16 text-center">
          <div className="bg-secondary text-muted-foreground mx-auto mb-3 grid size-12 place-items-center rounded-full">
            <Search size={20} />
          </div>
          <div className="text-[14px] font-medium">{t("pages.assets.empty.noMatches.title")}</div>
          <div className="text-muted-foreground mt-1 text-[12.5px]">
            {t("pages.assets.empty.noMatches.description")}
          </div>
        </Card>
      ) : (
        <>
          {view === "rows" && (
            <RowsView
              pageRows={pageRows}
              selected={selected}
              onToggleOne={handleToggleOne}
              onToggleAll={handleToggleAll}
            />
          )}
          {view === "hybrid" && <HybridView pageRows={pageRows} />}
          {view === "grid" && <GridView pageRows={pageRows} />}

          {/* ── Bottom paginator ──────────────────────────────── */}
          <div className="border-border mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <div className="text-muted-foreground flex items-center gap-2 text-[12px]">
              <span>{t("paginator.rowsPerPage")}</span>
              <select
                value={PAGE_SIZE}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
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
              <span className="hidden sm:inline">·</span>
              <span className="hidden font-mono tabular-nums sm:inline">
                {t("paginator.range", {
                  from: rangeFrom.toLocaleString(),
                  to: rangeTo.toLocaleString(),
                  total: filtered.length.toLocaleString(),
                })}
              </span>
            </div>
            <Paginator page={page} totalPages={totalPages} onChange={handlePageChange} />
          </div>
        </>
      )}
    </div>
  );
}
