import { ASSET_STATES } from "@shared/backend-api";
import React from "react";
import { useTranslation } from "react-i18next";

import { EmptyState } from "@/components/common/EmptyState";
import { useAssets } from "@/features/assets/hooks/useAssets";

export function AssetsListPage(): React.JSX.Element {
  const { t } = useTranslation();
  const { data } = useAssets({});
  const total: number = data?.total ?? 0;
  const shown: number = data?.data.length ?? 0;
  const page: number = data?.page ?? 1;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-[22px] font-bold tracking-tight text-neutral-900">
          {t("pages.assets.title")}
        </h1>
        <div aria-label={t("pages.assets.bulkActions.label")}>
          <button
            type="button"
            disabled
            title={t("pages.assets.bulkActions.comingSoon")}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-400"
          >
            {t("pages.assets.bulkActions.label")}
          </button>
        </div>
      </header>

      {/* Filter rail */}
      <section className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <label className="flex flex-col gap-1 text-xs text-neutral-600">
          {t("pages.assets.filterByNamespace")}
          <select
            disabled
            className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-sm text-neutral-400"
          >
            <option>—</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-600">
          {t("pages.assets.filterByState")}
          {/* TODO(slice-1): wire state filter to URL searchParams */}
          <select className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm">
            <option value="">—</option>
            {ASSET_STATES.map((state) => (
              <option key={state} value={state}>
                {t(`assetStates.${state}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-600">
          {t("pages.assets.filterByDate")}
          <input
            type="date"
            disabled
            className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-sm text-neutral-400"
          />
        </label>
      </section>

      {/* Table */}
      <section className="overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-[10.5px] tracking-wider text-neutral-500 uppercase">
            <tr>
              <th className="px-4 py-2">{t("pages.assets.table.asset")}</th>
              <th className="px-4 py-2">{t("pages.assets.table.namespace")}</th>
              <th className="px-4 py-2">{t("pages.assets.table.state")}</th>
              <th className="px-4 py-2 text-right">{t("pages.assets.table.size")}</th>
              <th className="px-4 py-2">{t("pages.assets.table.uploaded")}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5}>
                <EmptyState
                  title={t("pages.assets.empty.title")}
                  description={t("pages.assets.empty.description")}
                />
              </td>
            </tr>
          </tbody>
        </table>
        <footer className="border-t border-neutral-200 px-4 py-2 text-xs text-neutral-500">
          {t("pages.assets.pagination", { shown, total, page })}
        </footer>
      </section>
    </div>
  );
}
