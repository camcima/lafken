import { CheckCircle } from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";

import { EmptyState } from "@/components/common/EmptyState";
import { useQuarantine } from "@/features/quarantine/hooks/useQuarantine";

export function QuarantinePage(): React.JSX.Element {
  const { t } = useTranslation();
  useQuarantine();

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-[22px] font-bold tracking-tight text-neutral-900">
          {t("pages.quarantine.title")}
        </h1>
      </header>

      <section className="rounded-lg border border-neutral-200 bg-white shadow-sm">
        <EmptyState
          icon={CheckCircle}
          title={t("pages.quarantine.empty.title")}
          description={t("pages.quarantine.empty.description")}
        />
      </section>
    </div>
  );
}
