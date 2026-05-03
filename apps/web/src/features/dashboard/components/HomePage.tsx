import { CheckCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

import { EmptyState } from "@/components/common/EmptyState";
import { useDashboardOverview } from "@/features/dashboard/hooks/useDashboardOverview";
import { useAuth } from "@/hooks/useAuth";

import { StatCard } from "./StatCard";

export function HomePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data, isLoading } = useDashboardOverview();
  const counts = data?.counts;
  const indicators = data?.health?.indicators ?? [];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold tracking-tight text-neutral-900">
            {t("pages.home.subtitle")}
          </h1>
          {user?.name ? (
            <div className="mt-1 text-[12.5px] text-neutral-500">
              <span>Welcome back, {user.name}.</span>
              <span className="mx-2">·</span>
              <span>
                {t("pages.home.lastRefreshed")}{" "}
                <span className="font-mono">{t("pages.home.justNow")}</span>
              </span>
            </div>
          ) : null}
        </div>
      </header>

      {/* KPI stats */}
      <section className="rounded-lg border border-neutral-200 bg-white shadow-sm">
        <div className="grid grid-cols-2 divide-x divide-y divide-neutral-200 sm:grid-cols-3 sm:divide-y-0 lg:grid-cols-5">
          <StatCard label={t("pages.home.stats.totalAssets")} value={counts?.totalAssets ?? 0} />
          <StatCard label={t("pages.home.stats.inFlight")} value={counts?.inFlight ?? 0} />
          <StatCard label={t("pages.home.stats.queueDepth")} value={counts?.queueDepth ?? 0} />
          <StatCard label={t("pages.home.stats.quarantine")} value={counts?.quarantine ?? 0} />
          <StatCard label={t("pages.home.stats.legalHolds")} value={counts?.legalHolds ?? 0} />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Pipeline health — spans 2 cols */}
        <section className="rounded-lg border border-neutral-200 bg-white shadow-sm lg:col-span-2">
          <header className="border-b border-neutral-200 px-5 py-3">
            <h2 className="text-sm font-medium text-neutral-900">
              {t("pages.home.pipelineHealth")}
            </h2>
          </header>
          <div className="px-5 py-3">
            {isLoading ? (
              <p className="text-sm text-neutral-500">{t("pages.home.checking")}</p>
            ) : indicators.length > 0 ? (
              <ul className="divide-y divide-neutral-100">
                {indicators.map((indicator) => (
                  <li
                    key={indicator.name}
                    className="flex items-center justify-between py-2.5 text-sm"
                  >
                    <span className="font-mono text-[12.5px] text-neutral-700">
                      {indicator.name}
                    </span>
                    <span className="text-[12px] text-neutral-500">{indicator.status}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title={t("pages.home.checking")} className="py-6" />
            )}
          </div>
        </section>

        {/* Needs attention */}
        <section className="rounded-lg border border-neutral-200 bg-white shadow-sm">
          <header className="border-b border-neutral-200 px-5 py-3">
            <h2 className="text-sm font-medium text-neutral-900">
              {t("pages.home.needsAttention")}
            </h2>
          </header>
          <EmptyState icon={CheckCircle} title={t("pages.home.needsAttentionEmpty")} />
        </section>

        {/* Top namespaces — spans 2 cols */}
        <section className="rounded-lg border border-neutral-200 bg-white shadow-sm lg:col-span-2">
          <header className="border-b border-neutral-200 px-5 py-3">
            <h2 className="text-sm font-medium text-neutral-900">
              {t("pages.home.topNamespaces")}
            </h2>
          </header>
          <EmptyState title={t("pages.home.topNamespacesEmpty")} />
        </section>

        {/* Live events */}
        <section className="rounded-lg border border-neutral-200 bg-white shadow-sm">
          <header className="border-b border-neutral-200 px-5 py-3">
            <h2 className="text-sm font-medium text-neutral-900">{t("pages.home.liveEvents")}</h2>
          </header>
          <EmptyState title={t("pages.home.liveEventsEmpty")} />
        </section>
      </div>
    </div>
  );
}
