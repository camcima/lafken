import type { AssetState, NamespaceResponseDTO } from "@shared/backend-api";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Download, Filter, Lock, Plus, Search, Tag, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { Paginator } from "@/components/common/Paginator";
import { SELECT_CLASS, SELECT_CLASS_SM } from "@/components/common/select-styles";
import { assetResponseToRow, type IAssetRow } from "@/features/assets/asset-row";
import {
  AssetsListView,
  getAutoPageSize,
  type ViewMode,
  ViewToggle,
} from "@/features/assets/components/assets-list-view";
import { useAssets } from "@/features/assets/hooks/useAssets";
import { useNamespaces } from "@/features/namespaces/hooks/useNamespaces";
import { cn } from "@/lib/utils";

// Page-size options for the rows-per-page selector
/* eslint-disable no-magic-numbers */
const PAGE_SIZE_OPTIONS = [18, 24, 50, 100, 200] as const;
/* eslint-enable no-magic-numbers */

const NAMESPACE_FILTER_LIMIT = 100;

const QUICK_FILTER_KEYS = [
  "last24h",
  "hasLegalHold",
  "quarantined",
  "failedPipelines",
  "mine",
] as const;

// Slice 1: wire to active more-filters count
const MORE_FILTERS_BADGE_PLACEHOLDER = 2;

interface INamespaceOption {
  slug: string;
  label: string;
}

export function AssetsListPage(): React.JSX.Element {
  const { t } = useTranslation();
  const { legalHoldId, namespaceSlug } = useSearch({ from: "/_protected/assets/" });
  const navigate = useNavigate();

  const [view, setView] = useState<ViewMode>("rows");
  const [stateFilter, setStateFilter] = useState("all");
  const namespaceFilter: string = namespaceSlug ?? "all";
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(() => new Set<string>());
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(0); // 0 => use AUTO_PAGE_SIZE

  const autoPageSize = getAutoPageSize(view);
  const PAGE_SIZE = pageSize || autoPageSize;

  // ── Real-API queries ────────────────────────────────────────────────────
  const listQuery = {
    page: page + 1,
    limit: PAGE_SIZE,
    namespaceSlug: namespaceFilter !== "all" ? namespaceFilter : undefined,
    states: stateFilter !== "all" ? [stateFilter as AssetState] : undefined,
    legalHoldId,
  };
  const { data: realAssetsPage, isLoading: realAssetsLoading } = useAssets(listQuery);

  const { data: realNamespacesPage } = useNamespaces({
    page: 1,
    limit: NAMESPACE_FILTER_LIMIT,
  });

  // The BE handles state/namespace/page/limit; only the free-text search is
  // applied client-side over the loaded page (matches the full publicId).
  const realRows: IAssetRow[] = useMemo(
    () => (realAssetsPage?.data ?? []).map(assetResponseToRow),
    [realAssetsPage],
  );

  const realFiltered: IAssetRow[] = useMemo(() => {
    if (!query) return realRows;
    const q = query.toLowerCase();
    return realRows.filter((row) => row.publicId.toLowerCase().includes(q));
  }, [realRows, query]);

  const pageRows: IAssetRow[] = realFiltered;

  const totalItems: number = realAssetsPage?.total ?? 0;
  const totalPages: number = Math.max(1, realAssetsPage?.lastPage ?? 1);

  const namespaceOptions: INamespaceOption[] = useMemo(() => {
    const real: NamespaceResponseDTO[] = realNamespacesPage?.data ?? [];
    return real.map((ns) => ({ slug: ns.slug, label: ns.slug }));
  }, [realNamespacesPage]);

  const isLoading = realAssetsLoading;
  const isEmpty = !isLoading && pageRows.length === 0;

  const hasActiveFilters = stateFilter !== "all" || namespaceFilter !== "all" || query !== "";

  function handleStateFilter(value: string): void {
    setStateFilter(value);
    setPage(0);
    setSelected(new Set());
  }

  function handleNamespaceFilter(value: string): void {
    void navigate({
      to: "/assets",
      search: (prev) => ({ ...prev, namespaceSlug: value === "all" ? undefined : value }),
    });
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
    void navigate({
      to: "/assets",
      search: (prev) => ({ ...prev, namespaceSlug: undefined }),
    });
    setQuery("");
    setPage(0);
    setSelected(new Set());
  }

  function handleToggleOne(rowKey: string, checked: boolean): void {
    const next = new Set(selected);
    if (checked) {
      next.add(rowKey);
    } else {
      next.delete(rowKey);
    }
    setSelected(next);
  }

  function handleToggleAll(checked: boolean): void {
    const next = new Set(selected);
    pageRows.forEach((row) => {
      if (checked) {
        next.add(row.rowKey);
      } else {
        next.delete(row.rowKey);
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
  const rangeFrom: number = totalItems === 0 ? 0 : page * PAGE_SIZE + 1;
  const rangeTo: number = Math.min((page + 1) * PAGE_SIZE, totalItems);

  // Header subtitle counters
  const headerTotal: number = totalItems;
  const headerNsCount: number = namespaceOptions.length;

  return (
    <div className="space-y-4">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="mb-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="m-0 text-[22px] font-bold tracking-tight">{t("pages.assets.title")}</h1>
            <div className="text-muted-foreground mt-1 text-[12.5px]">
              {t("pages.assets.subtitle", {
                total: headerTotal.toLocaleString(),
                nsCount: headerNsCount,
              })}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ViewToggle view={view} onChange={handleViewChange} />
            <Button type="button" variant="outline">
              <Download /> {t("pages.assets.actions.export")}
            </Button>
            <Button asChild variant="indigo">
              <Link to="/assets/upload">
                <Plus /> {t("pages.assets.actions.upload")}
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* ── Filter bar ─────────────────────────────────────── */}
      <Card className={cn("mb-4 p-3")}>
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
            {namespaceOptions.map((ns) => (
              <option key={ns.slug} value={ns.slug}>
                {ns.label}
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

      {/* ── Legal hold filter banner ────────────────────────── */}
      {legalHoldId !== undefined && (
        <div className="border-warn/40 bg-warn-soft/40 mb-3 flex items-center justify-between rounded-md border px-4 py-2 text-sm">
          <span>{t("pages.assets.legalHoldFilter.banner", { holdId: legalHoldId })}</span>
          <Link to="/assets" search={{}}>
            <span className="text-latam-indigo hover:underline">
              {t("pages.assets.legalHoldFilter.clear")}
            </span>
          </Link>
        </div>
      )}

      {/* ── Stats line ──────────────────────────────────────── */}
      <div className="text-muted-foreground mb-3 text-[12px]">
        {totalItems === 0
          ? t("pages.assets.summaryEmpty")
          : t("pages.assets.summaryRange", {
              from: rangeFrom.toLocaleString(),
              to: rangeTo.toLocaleString(),
              total: totalItems.toLocaleString(),
            })}
      </div>

      {/* ── Content area ──────────────────────────────────────── */}
      {isLoading ? (
        <Card className="px-8 py-16 text-center">
          <div className="text-muted-foreground text-[12.5px]">
            {t("pages.namespaceDetail.loading")}
          </div>
        </Card>
      ) : isEmpty ? (
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
          <AssetsListView
            rows={pageRows}
            view={view}
            selected={selected}
            onToggleOne={handleToggleOne}
            onToggleAll={handleToggleAll}
          />

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
                  total: totalItems.toLocaleString(),
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
