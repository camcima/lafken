import React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/common/Button";
import { EmptyState } from "@/components/common/EmptyState";
import { useNamespaces } from "@/features/namespaces/hooks/useNamespaces";

export function NamespacesListPage(): React.JSX.Element {
  const { t } = useTranslation();
  const { data } = useNamespaces();
  const rows = data?.data ?? [];

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-[22px] font-bold tracking-tight text-neutral-900">
          {t("pages.namespaces.title")}
        </h1>
        <Button disabled title={t("nav.comingInSlice1")}>
          {t("pages.namespaces.create")}
        </Button>
      </header>

      <section className="overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-[10.5px] tracking-wider text-neutral-500 uppercase">
            <tr>
              <th className="px-4 py-2">{t("pages.namespaces.table.slug")}</th>
              <th className="px-4 py-2">{t("pages.namespaces.table.displayName")}</th>
              <th className="px-4 py-2">{t("pages.namespaces.table.storage")}</th>
              <th className="px-4 py-2">{t("pages.namespaces.table.policyVersion")}</th>
              <th className="px-4 py-2 text-right">{t("pages.namespaces.table.assetCount")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <EmptyState
                    title={t("pages.namespaces.empty.title")}
                    description={t("pages.namespaces.empty.description")}
                  />
                </td>
              </tr>
            ) : (
              rows.map((ns) => (
                <tr key={ns.slug} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-2 font-mono text-xs">{ns.slug}</td>
                  <td className="px-4 py-2">{ns.displayName}</td>
                  <td className="px-4 py-2">{ns.storageBindingName}</td>
                  <td className="px-4 py-2">{ns.currentPolicyVersion}</td>
                  <td className="px-4 py-2 text-right">—</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
