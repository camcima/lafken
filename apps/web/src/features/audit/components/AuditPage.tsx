import React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/common/Button";
import { EmptyState } from "@/components/common/EmptyState";
import { useAuditEntries } from "@/features/audit/hooks/useAudit";

export function AuditPage(): React.JSX.Element {
  const { t } = useTranslation();
  const { data } = useAuditEntries();
  const rows = data?.data ?? [];

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-[22px] font-bold tracking-tight text-neutral-900">
          {t("pages.audit.title")}
        </h1>
        <Button disabled title={t("nav.comingInSlice1")}>
          {t("pages.audit.export")}
        </Button>
      </header>

      {/* Filter form — uncontrolled in Slice 0 */}
      <section className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <label className="flex flex-col gap-1 text-xs text-neutral-600">
          {t("pages.audit.filters.principal")}
          <input
            type="text"
            disabled
            placeholder="—"
            className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-sm text-neutral-400"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-600">
          {t("pages.audit.filters.action")}
          <input
            type="text"
            disabled
            placeholder="—"
            className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-sm text-neutral-400"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-600">
          {t("pages.audit.filters.entity")}
          <input
            type="text"
            disabled
            placeholder="—"
            className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-sm text-neutral-400"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-600">
          {t("pages.audit.filters.from")}
          <input
            type="date"
            disabled
            className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-sm text-neutral-400"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-600">
          {t("pages.audit.filters.to")}
          <input
            type="date"
            disabled
            className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-sm text-neutral-400"
          />
        </label>
      </section>

      {/* Results */}
      <section className="rounded-lg border border-neutral-200 bg-white shadow-sm">
        {rows.length === 0 ? <EmptyState title={t("pages.audit.empty.title")} /> : null}
      </section>
    </div>
  );
}
