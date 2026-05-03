import { Link } from "@tanstack/react-router";
import { AlertTriangle, ChevronRight, Lock, Server, ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Card, CardHeader, CardMeta, CardTitle } from "@/components/common/Card";
import { Sparkline } from "@/components/common/Sparkline";
import { useDashboardOverview } from "@/features/dashboard/hooks/useDashboardOverview";
import { useAuth } from "@/hooks/useAuth";
import {
  DEMO_AUDIT,
  DEMO_NAMESPACES,
  DEMO_QUEUE_SPARKS,
  DEMO_QUEUES,
  DEMO_WORKERS,
  fmtMinAgo,
} from "@/lib/demo/lafken-demo-data";
import type { DemoAuditEntry, DemoQueue } from "@/lib/demo/lafken-demo-data";
import { cn } from "@/lib/utils";

// Thresholds for queue depth color coding
const QUEUE_DEPTH_ALERT_THRESHOLD = 1000;
const QUEUE_DEPTH_WARN_THRESHOLD = 100;

// Total assets denominator for namespace progress bar
const NAMESPACE_TOTAL_ASSETS = 2_400_000;
const NAMESPACE_ASSET_DIVISOR = 1_000_000;
const NAMESPACE_PCT_MULTIPLIER = 100;

// Namespace upload estimate multiplier/base
const NAMESPACE_UPLOAD_MULTIPLIER = 0.0003;
const NAMESPACE_UPLOAD_BASE = 41;

// Demo fallback values for KPI strip
const DEMO_QUARANTINE_COUNT = 47;
const DEMO_QUARANTINE_DISPLAY = "47";
const DEMO_LEGAL_HOLDS_DISPLAY = "12";
const DEMO_TOTAL_ASSETS_DISPLAY = "2.42M";

// Number of attention items in the "Needs attention" card
const NEEDS_ATTENTION_COUNT = 3;

// Number of audit events shown in the live feed
const LIVE_EVENTS_DISPLAY_COUNT = 8;

// Number of namespaces shown in the top namespaces card
const TOP_NAMESPACES_COUNT = 5;

// Fallback worker id when no down worker is found
const FALLBACK_DOWN_WORKER_ID = "processor-12";

// Default case ref for the hold pending attention row
const DEMO_HOLD_CASE_REF = "CHL-2025-AVN-077";

function eventTone(event: DemoAuditEntry): string {
  if (event.result === "fail") return "text-danger";
  if (event.type.includes("hold")) return "text-warn";
  if (event.type.includes("quarantined")) return "text-alert";
  return "text-muted-foreground";
}

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

interface IQueueRowProps {
  queue: DemoQueue;
}

function QueueRow({ queue }: IQueueRowProps) {
  const tone = queue.trend;
  const sparks = DEMO_QUEUE_SPARKS[queue.name] ?? [0];
  return (
    <div className="border-border/40 grid grid-cols-[80px_1fr_56px_56px_56px_18px] items-center gap-2 border-b py-2.5 last:border-b-0 sm:grid-cols-[110px_1fr_70px_70px_70px_22px] sm:gap-3">
      <div className="font-mono text-[12.5px]">{queue.name}</div>
      <div className="min-w-0">
        <Sparkline values={sparks} tone={tone} />
      </div>
      <div className="text-right">
        <div className="font-mono text-[12.5px] tabular-nums">{queue.inflight}</div>
        <div className="text-muted-foreground text-[10px] tracking-wide uppercase">in flight</div>
      </div>
      <div className="text-right">
        <div
          className={cn(
            "font-mono text-[12.5px] tabular-nums",
            queue.depth > QUEUE_DEPTH_ALERT_THRESHOLD
              ? "text-alert"
              : queue.depth > QUEUE_DEPTH_WARN_THRESHOLD
                ? "text-warn"
                : "text-foreground",
          )}
        >
          {queue.depth.toLocaleString()}
        </div>
        <div className="text-muted-foreground text-[10px] tracking-wide uppercase">queued</div>
      </div>
      <div className="text-right">
        <div className="font-mono text-[12.5px] tabular-nums">{queue.p95_ms}ms</div>
        <div className="text-muted-foreground text-[10px] tracking-wide uppercase">p95</div>
      </div>
      <div className="flex justify-end">
        <span
          className={cn(
            "size-2 rounded-full",
            tone === "alert" ? "bg-alert" : tone === "warn" ? "bg-warn" : "bg-ok",
          )}
        />
      </div>
    </div>
  );
}

interface IEventRowProps {
  event: DemoAuditEntry;
}

function EventRow({ event }: IEventRowProps) {
  const tone = eventTone(event);
  return (
    <div className="border-border/30 grid grid-cols-[44px_1fr] gap-2 border-b py-1.5 text-[11.5px] last:border-b-0">
      <span className="text-muted-foreground font-mono tabular-nums">
        {fmtMinAgo(event.minutesAgo)}
      </span>
      <div className="min-w-0">
        <span className={cn("font-mono", tone)}>{event.type}</span>
        <div className="text-muted-foreground truncate font-mono text-[10.5px]">{event.actor}</div>
      </div>
    </div>
  );
}

export function HomePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data } = useDashboardOverview();

  const queues = DEMO_QUEUES;

  const totalDepth = queues.reduce((acc, queue) => acc + queue.depth, 0);
  const totalInflight = queues.reduce((acc, queue) => acc + queue.inflight, 0);

  const downWorker = DEMO_WORKERS.find((worker) => worker.status === "down");

  const overallTone: "alert" | "warn" | "ok" = queues.some((queue) => queue.trend === "alert")
    ? "alert"
    : queues.some((queue) => queue.trend === "warn")
      ? "warn"
      : "ok";

  const bannerMessage =
    overallTone === "alert"
      ? t("pages.home.attentionBanner.alert")
      : overallTone === "warn"
        ? t("pages.home.attentionBanner.warn")
        : t("pages.home.attentionBanner.ok");

  const recentEvents = DEMO_AUDIT.slice(0, LIVE_EVENTS_DISPLAY_COUNT);

  const apiTotalAssets = data?.counts?.totalAssets ?? 0;
  const totalAssetsValue =
    apiTotalAssets > 0
      ? (apiTotalAssets / NAMESPACE_ASSET_DIVISOR).toFixed(2) + "M"
      : DEMO_TOTAL_ASSETS_DISPLAY;

  const apiInFlight = data?.counts?.inFlight ?? 0;
  const inFlightValue =
    apiInFlight > 0 ? apiInFlight.toLocaleString() : totalInflight.toLocaleString();

  const apiQueueDepth = data?.counts?.queueDepth ?? 0;
  const queueDepthValue =
    apiQueueDepth > 0 ? apiQueueDepth.toLocaleString() : totalDepth.toLocaleString();

  const apiQuarantine = data?.counts?.quarantine ?? 0;
  const quarantineValue = apiQuarantine > 0 ? apiQuarantine.toString() : DEMO_QUARANTINE_DISPLAY;

  const apiLegalHolds = data?.counts?.legalHolds ?? 0;
  const legalHoldsValue = apiLegalHolds > 0 ? apiLegalHolds.toString() : DEMO_LEGAL_HOLDS_DISPLAY;

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
            <span className="font-mono">prod · sa-east-1</span>
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
          overallTone === "alert"
            ? "border-alert-line bg-alert-soft text-alert"
            : overallTone === "warn"
              ? "border-warn-line bg-warn-soft text-warn"
              : "border-ok-line bg-ok-soft text-ok",
        )}
      >
        <AlertTriangle size={16} />
        <div className="flex-1">
          <div className="text-[13px] font-semibold">{bannerMessage}</div>
          {overallTone !== "ok" ? (
            <div className="text-[12px] opacity-90">{t("pages.home.attentionBanner.detail")}</div>
          ) : null}
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
              hint={t("pages.home.kpi.inFlightHint", { stages: queues.length })}
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
          <div className="px-5 py-3">
            {queues.map((queue) => (
              <QueueRow key={queue.name} queue={queue} />
            ))}
          </div>
        </Card>

        {/* Needs attention */}
        <Card>
          <CardHeader>
            <CardTitle>{t("pages.home.needsAttention")}</CardTitle>
            <CardMeta>
              {NEEDS_ATTENTION_COUNT} {t("pages.home.needsAttentionCount")}
            </CardMeta>
          </CardHeader>
          <div className="divide-border/60 divide-y">
            <Link
              to="/quarantine"
              className="hover:bg-secondary/40 flex items-start gap-3 px-5 py-3 no-underline"
            >
              <span className="bg-alert-soft text-alert mt-0.5 grid size-7 flex-none place-items-center rounded-md">
                <ShieldAlert size={14} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-medium">
                  {t("pages.home.attention.quarantineTitle", { count: DEMO_QUARANTINE_COUNT })}
                </div>
                <div className="text-muted-foreground text-[11.5px]">
                  {t("pages.home.attention.quarantineDetail")}
                </div>
              </div>
              <ChevronRight size={12} className="text-muted-foreground mt-1" />
            </Link>
            <Link
              to="/system"
              className="hover:bg-secondary/40 flex items-start gap-3 px-5 py-3 no-underline"
            >
              <span className="bg-alert-soft text-alert mt-0.5 grid size-7 flex-none place-items-center rounded-md">
                <Server size={14} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-medium">
                  {t("pages.home.attention.workerDownTitle", {
                    id: downWorker?.id ?? FALLBACK_DOWN_WORKER_ID,
                  })}
                </div>
                <div className="text-muted-foreground text-[11.5px]">
                  {t("pages.home.attention.workerDownDetail")}
                </div>
              </div>
              <ChevronRight size={12} className="text-muted-foreground mt-1" />
            </Link>
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
                  {t("pages.home.attention.holdPendingDetail", { caseRef: DEMO_HOLD_CASE_REF })}
                </div>
              </div>
              <ChevronRight size={12} className="text-muted-foreground mt-1" />
            </Link>
          </div>
        </Card>

        {/* Top namespaces — spans 2 cols */}
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("pages.home.topNamespaces")}</CardTitle>
            <CardMeta>{t("pages.home.topNamespacesMeta")}</CardMeta>
          </CardHeader>
          <div className="px-5 py-3">
            {DEMO_NAMESPACES.slice(0, TOP_NAMESPACES_COUNT).map((namespace) => {
              const upload24 = Math.floor(
                namespace.assetCount * NAMESPACE_UPLOAD_MULTIPLIER + NAMESPACE_UPLOAD_BASE,
              );
              const pct =
                (namespace.assetCount / NAMESPACE_TOTAL_ASSETS) * NAMESPACE_PCT_MULTIPLIER;
              const pctStr = String(pct) + "%";
              return (
                <Link
                  key={namespace.slug}
                  to="/namespaces"
                  className="border-border/40 hover:bg-secondary/30 grid grid-cols-[120px_1fr_60px_50px] items-center gap-3 border-b py-2 no-underline last:border-b-0 sm:grid-cols-[180px_1fr_70px_60px] sm:gap-4"
                >
                  <div>
                    <div className="text-latam-indigo-deep font-mono text-[12.5px]">
                      {namespace.slug}
                    </div>
                    <div className="text-muted-foreground text-[11px]">
                      policy v{namespace.policyVersion}
                    </div>
                  </div>
                  <div className="bg-secondary relative h-2 overflow-hidden rounded-full">
                    <div
                      className="bg-latam-indigo absolute inset-y-0 left-0 rounded-full"
                      style={{ width: pctStr }}
                    />
                  </div>
                  <div className="text-right font-mono text-[12px] tabular-nums">
                    {(namespace.assetCount / NAMESPACE_ASSET_DIVISOR).toFixed(2)}M
                  </div>
                  <div className="text-ok text-right font-mono text-[12px] tabular-nums">
                    +{upload24}
                  </div>
                </Link>
              );
            })}
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
            {recentEvents.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
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
