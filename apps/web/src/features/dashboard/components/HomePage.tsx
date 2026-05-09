import { Link } from "@tanstack/react-router";
import { AlertTriangle, ChevronRight, Lock, ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Card, CardHeader, CardMeta, CardTitle } from "@/components/common/Card";
import { getRuntimeValue } from "@/config/app-config";
import { useDashboardOverview } from "@/features/dashboard/hooks/useDashboardOverview";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

// Total assets denominator for namespace progress bar
const NAMESPACE_ASSET_DIVISOR = 1_000_000;

interface IKpiStatProps {
  label: string;
  value: string;
  hint: string;
  tone?: "default" | "ok" | "warn" | "alert" | "danger";
}

function KpiStat({ label, value, hint, tone = "default" }: IKpiStatProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-muted-foreground text-[10.5px] tracking-wider uppercase">{label}</div>
      <div
        className={cn(
          "font-mono text-[28px] leading-none tracking-tight",
          tone === "ok" && "text-ok",
          tone === "warn" && "text-warn",
          tone === "alert" && "text-alert",
          tone === "danger" && "text-danger",
        )}
      >
        {value}
      </div>
      <div className="text-muted-foreground text-[11.5px]">{hint}</div>
    </div>
  );
}

export function HomePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data } = useDashboardOverview();

  const overallTone: "alert" | "warn" | "ok" = "ok";

  const bannerMessage = t("pages.home.attentionBanner.ok");

  const hasApiCounts = data?.counts !== undefined;
  const apiTotalAssets = data?.counts?.totalAssets ?? 0;
  const totalAssetsValue = hasApiCounts
    ? apiTotalAssets > 0
      ? (apiTotalAssets / NAMESPACE_ASSET_DIVISOR).toFixed(2) + "M"
      : "0"
    : t("pages.home.kpi.totalAssets");

  const apiInFlight = data?.counts?.inFlight ?? 0;
  const inFlightValue = hasApiCounts ? apiInFlight.toLocaleString() : "0";

  const apiQueueDepth = data?.counts?.queueDepth ?? 0;
  const queueDepthValue = hasApiCounts ? apiQueueDepth.toLocaleString() : "0";

  const apiQuarantine = data?.counts?.quarantine ?? 0;
  const quarantineValue = hasApiCounts ? apiQuarantine.toString() : "0";

  const apiLegalHolds = data?.counts?.legalHolds ?? 0;
  const legalHoldsValue = hasApiCounts ? apiLegalHolds.toString() : "0";

  const needsAttentionCount = apiQuarantine + apiLegalHolds;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="m-0 text-[22px] font-bold tracking-tight">{t("pages.home.subtitle")}</h1>
          <div className="text-muted-foreground mt-1 text-[12.5px]">
            {user?.name ? (
              <>
                <span>{t("pages.home.welcomeBack", { name: user.name })}</span>
                <span className="text-foreground/30 mx-2">·</span>
              </>
            ) : null}
            <span className="font-mono">{getRuntimeValue("ENVIRONMENT")} · sa-east-1</span>
            <span className="text-foreground/30 mx-2">·</span>
            <span>
              {t("pages.home.lastRefreshed")}{" "}
              <span className="font-mono">{t("pages.home.justNow")}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Attention banner */}
      <div
        className={cn(
          "flex items-center gap-3 rounded-md border px-4 py-3",
          "border-ok-line bg-ok-soft text-ok",
        )}
      >
        <AlertTriangle size={16} />
        <div className="flex-1">
          <div className="text-[13px] font-semibold">{bannerMessage}</div>
          <div className="text-[12px] opacity-90">
            {overallTone !== "ok"
              ? t("pages.home.attentionBanner.detail")
              : t("pages.home.attentionBanner.detailOk")}
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <Card>
        <div className="divide-border grid grid-cols-2 divide-x divide-y sm:grid-cols-3 sm:divide-y-0 lg:grid-cols-5">
          <div className="px-5 py-4">
            <KpiStat
              label={t("pages.home.stats.totalAssets")}
              value={totalAssetsValue}
              hint={t("pages.home.kpi.totalAssetsHint")}
            />
          </div>
          <div className="px-5 py-4">
            <KpiStat
              label={t("pages.home.stats.inFlight")}
              value={inFlightValue}
              hint={t("pages.home.kpi.inFlightHint", { stages: 0 })}
            />
          </div>
          <div className="px-5 py-4">
            <KpiStat
              label={t("pages.home.stats.queueDepth")}
              value={queueDepthValue}
              hint={t("pages.home.kpi.queueDepthHint")}
              tone="alert"
            />
          </div>
          <div className="px-5 py-4">
            <KpiStat
              label={t("pages.home.stats.quarantine")}
              value={quarantineValue}
              hint={t("pages.home.kpi.quarantineHint")}
              tone="alert"
            />
          </div>
          <div className="px-5 py-4">
            <KpiStat
              label={t("pages.home.stats.legalHolds")}
              value={legalHoldsValue}
              hint={t("pages.home.kpi.legalHoldsHint")}
              tone="warn"
            />
          </div>
        </div>
      </Card>

      {/* 3-column grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Pipeline health — spans 2 cols */}
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("pages.home.pipelineHealth")}</CardTitle>
            <CardMeta>{t("pages.home.pipelineHealthMeta")}</CardMeta>
          </CardHeader>
          <div className="text-muted-foreground px-5 py-8 text-center text-[12.5px]">
            {t("pages.home.liveEventsEmpty")}
          </div>
        </Card>

        {/* Needs attention */}
        <Card>
          <CardHeader>
            <CardTitle>{t("pages.home.needsAttention")}</CardTitle>
            <CardMeta>
              {needsAttentionCount} {t("pages.home.needsAttentionCount")}
            </CardMeta>
          </CardHeader>
          {needsAttentionCount > 0 ? (
            <div className="divide-border/60 divide-y">
              {apiQuarantine > 0 && (
                <Link
                  to="/quarantine"
                  className="hover:bg-secondary/40 flex items-start gap-3 px-5 py-3 no-underline"
                >
                  <span className="bg-alert-soft text-alert mt-0.5 grid size-7 flex-none place-items-center rounded-md">
                    <ShieldAlert size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-medium">
                      {t("pages.home.attention.quarantineTitle", {
                        count: apiQuarantine,
                      })}
                    </div>
                    <div className="text-muted-foreground text-[11.5px]">
                      {t("pages.home.attention.quarantineDetail")}
                    </div>
                  </div>
                  <ChevronRight size={12} className="text-muted-foreground mt-1" />
                </Link>
              )}
              {apiLegalHolds > 0 && (
                <Link
                  to="/legal-holds"
                  className="hover:bg-secondary/40 flex items-start gap-3 px-5 py-3 no-underline"
                >
                  <span className="bg-warn-soft text-warn mt-0.5 grid size-7 flex-none place-items-center rounded-md">
                    <Lock size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-medium">
                      {t("pages.home.attention.holdPendingTitle")}
                    </div>
                    <div className="text-muted-foreground text-[11.5px]">
                      {t("pages.home.attention.holdPendingDetail", {
                        caseRef: "",
                      })}
                    </div>
                  </div>
                  <ChevronRight size={12} className="text-muted-foreground mt-1" />
                </Link>
              )}
            </div>
          ) : (
            <div className="text-muted-foreground px-5 py-8 text-center text-[12.5px]">
              {t("pages.home.needsAttentionEmpty")}
            </div>
          )}
        </Card>

        {/* Top namespaces — spans 2 cols */}
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("pages.home.topNamespaces")}</CardTitle>
            <CardMeta>{t("pages.home.topNamespacesMeta")}</CardMeta>
          </CardHeader>
          <div className="text-muted-foreground px-5 py-8 text-center text-[12.5px]">
            {t("pages.home.topNamespacesEmpty")}
          </div>
        </Card>

        {/* Live events */}
        <Card>
          <CardHeader>
            <CardTitle>{t("pages.home.liveEvents")}</CardTitle>
            <CardMeta className="text-ok">
              <span className="bg-ok inline-block size-1.5 animate-pulse rounded-full" />{" "}
              {t("pages.home.liveEventsStreaming")}
            </CardMeta>
          </CardHeader>
          <div className="px-5 py-2 text-[12px]">
            <div className="text-muted-foreground px-5 py-8 text-center text-[12.5px]">
              {t("pages.home.liveEventsEmpty")}
            </div>
            <Link
              to="/audit"
              className="text-latam-indigo block py-2 text-center text-[12px] hover:underline"
            >
              {t("pages.home.liveEventsViewAll")}
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
