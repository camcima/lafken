import React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/common/Button";
import { EmptyState } from "@/components/common/EmptyState";
import { useLegalHolds } from "@/features/legal-holds/hooks/useLegalHolds";

export function LegalHoldsListPage(): React.JSX.Element {
  const { t } = useTranslation();
  const { data } = useLegalHolds();
  const rows = data?.data ?? [];

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-[22px] font-bold tracking-tight text-neutral-900">
          {t("pages.legalHolds.title")}
        </h1>
        <Button disabled title={t("nav.comingInSlice1")}>
          {t("pages.legalHolds.place")}
        </Button>
      </header>

      <section className="rounded-lg border border-neutral-200 bg-white shadow-sm">
        {rows.length === 0 ? (
          <EmptyState
            title={t("pages.legalHolds.empty.title")}
            description={t("pages.legalHolds.empty.description")}
          />
        ) : null}
      </section>
    </div>
  );
}
