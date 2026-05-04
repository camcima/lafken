// Slice 1: SystemPage now reads real storage bindings via the BE; falls back
// to a typed demo card while the list is empty.
import type { StorageBindingResponseDTO } from "@shared/backend-api";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/common/Button";
import { Card, CardHeader, CardMeta, CardTitle } from "@/components/common/Card";
import { Sparkline } from "@/components/common/Sparkline";
import { DeleteStorageBindingDialog } from "@/features/system/components/DeleteStorageBindingDialog";
import { StorageBindingDrawer } from "@/features/system/components/StorageBindingDrawer";
import { useStorageBindings } from "@/features/system/hooks/useSystem";
import {
  DEMO_QUEUE_SPARKS,
  DEMO_QUEUES,
  DEMO_WORKERS,
  type DemoQueue,
  type DemoWorker,
} from "@/lib/demo/lafken-demo-data";
import { cn } from "@/lib/utils";

// ── Constants ─────────────────────────────────────────────
const ICON_SM = 13;
const ICON_XS = 12;
const PROGRESS_WARN = 60;
const PROGRESS_ALERT = 80;
const QUEUE_DEPTH_WARN = 1000;
const QUEUE_DEPTH_ALERT = 4000;
const P95_WARN = 2000;
const ISO_DATE_LENGTH = 10;

// ── Demo storage bindings ─────────────────────────────────
interface IStorageBinding {
  name: string;
  region: string;
  used: string;
  quota: string;
  pct: number;
  delta: string;
}

const DEMO_STORAGE_BINDINGS: IStorageBinding[] = [
  {
    name: "gcs-prod-aircraft-evidence",
    region: "southamerica-east1",
    used: "742.3 TB",
    quota: "1.20 PB",
    pct: 62,
    delta: "+4.1 TB",
  },
  {
    name: "gcs-prod-cargo-claims",
    region: "southamerica-east1",
    used: "118.6 TB",
    quota: "300 TB",
    pct: 39,
    delta: "+0.9 TB",
  },
  {
    name: "gcs-prod-hr-docs",
    region: "southamerica-east1",
    used: "21.4 TB",
    quota: "100 TB",
    pct: 21,
    delta: "+0.1 TB",
  },
];

// ── Demo dependencies ─────────────────────────────────────
interface IDependency {
  name: string;
  status: "ok" | "warn" | "alert";
  latency: string;
  note: string;
}

const DEMO_DEPS: IDependency[] = [
  { name: "moderation-v2", status: "ok", latency: "412ms", note: "self-hosted, sa-east-1" },
  { name: "clamav signatures", status: "ok", latency: "—", note: "27294 (2026-05-03)" },
  { name: "kms (key vault)", status: "ok", latency: "12ms", note: "rotated 12d ago" },
  { name: "object storage (gcs)", status: "ok", latency: "38ms", note: "all bindings green" },
  {
    name: "audit anchor (notarize)",
    status: "warn",
    latency: "1.8s",
    note: "elevated; non-blocking",
  },
];

// ── Sub-components ────────────────────────────────────────

function StatusBanner({ status }: { status: "ok" | "warn" | "degraded" }): React.JSX.Element {
  const { t } = useTranslation();

  const bannerLabel: Record<string, string> = {
    ok: t("pages.system.banner.ok"),
    warn: t("pages.system.banner.warn"),
    degraded: t("pages.system.banner.degraded"),
  };

  return (
    <Card
      className={cn(
        "mb-4 flex items-center gap-3 border-l-4 px-5 py-4",
        status === "ok" && "border-l-ok bg-ok-soft/40",
        status === "warn" && "border-l-warn bg-warn-soft/40",
        status === "degraded" && "border-l-alert bg-alert-soft/40",
      )}
    >
      <span
        className={cn(
          "size-3 rounded-full",
          status === "ok" && "bg-ok",
          status === "warn" && "bg-warn",
          status === "degraded" && "bg-alert animate-pulse",
        )}
      />
      <div className="flex-1">
        <div className="text-[13.5px] font-semibold">{bannerLabel[status]}</div>
        {status !== "ok" && (
          <div className="text-muted-foreground mt-0.5 text-[11.5px]">
            {t("pages.system.banner.degradedDetail")}
          </div>
        )}
      </div>
    </Card>
  );
}

function PipelineRow({ q }: { q: DemoQueue }): React.JSX.Element {
  const sparks = DEMO_QUEUE_SPARKS[q.name] ?? [];
  const tone = q.trend === "alert" ? "alert" : q.trend === "warn" ? "warn" : "ok";

  return (
    <div className="border-border/40 grid grid-cols-[140px_1fr_90px_90px_90px_60px] items-center gap-3 border-b px-5 py-2.5 last:border-b-0">
      <span className="font-mono text-[12.5px]">{q.name}</span>
      <Sparkline values={sparks} tone={tone} />
      <span className="text-right font-mono text-[12.5px] tabular-nums">{q.inflight}</span>
      <span
        className={cn(
          "text-right font-mono text-[12.5px] tabular-nums",
          q.depth > QUEUE_DEPTH_ALERT && "text-alert font-medium",
          q.depth > QUEUE_DEPTH_WARN && q.depth <= QUEUE_DEPTH_ALERT && "text-warn",
        )}
      >
        {q.depth.toLocaleString()}
      </span>
      <span
        className={cn(
          "text-right font-mono text-[12.5px] tabular-nums",
          q.p95_ms > P95_WARN && "text-warn",
        )}
      >
        {q.p95_ms}ms
      </span>
      <span
        className="ml-auto size-2 rounded-full"
        style={{
          background:
            q.trend === "alert" ? "var(--alert)" : q.trend === "warn" ? "var(--warn)" : "var(--ok)",
        }}
      />
    </div>
  );
}

function WorkerCard({ w: worker }: { w: DemoWorker }): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "rounded border p-2 text-[10.5px]",
        worker.status === "down" && "border-alert bg-alert-soft/40",
        worker.status === "alert" && "border-alert bg-alert-soft/30",
        worker.status === "warn" && "border-warn bg-warn-soft/30",
        worker.status === "ok" && "border-border bg-secondary/30",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="truncate font-mono text-[10.5px]">{worker.id}</span>
        <span
          className={cn(
            "size-1.5 rounded-full",
            worker.status === "ok" && "bg-ok",
            worker.status === "warn" && "bg-warn",
            worker.status === "alert" && "bg-alert",
            worker.status === "down" && "bg-alert animate-pulse",
          )}
        />
      </div>
      {worker.status === "down" ? (
        <div className="text-alert mt-1 font-medium tracking-wider uppercase">
          {t("pages.system.workers.statusDown")}
        </div>
      ) : (
        <div className="mt-1 grid grid-cols-2 gap-x-2 font-mono tabular-nums">
          <span className="text-muted-foreground">{t("pages.system.workers.metrics.cpu")}</span>
          <span className="text-right">{worker.cpu}%</span>
          <span className="text-muted-foreground">{t("pages.system.workers.metrics.mem")}</span>
          <span className="text-right">{worker.mem}%</span>
          <span className="text-muted-foreground">{t("pages.system.workers.metrics.flight")}</span>
          <span className="text-right">{worker.inflight}</span>
        </div>
      )}
      <div className="text-muted-foreground mt-1 truncate font-mono text-[9.5px]">
        {worker.pool}
      </div>
    </div>
  );
}

interface IRealStorageBindingRowProps {
  binding: StorageBindingResponseDTO;
  onEdit: (binding: StorageBindingResponseDTO) => void;
  onDelete: (binding: StorageBindingResponseDTO) => void;
}

function formatCreatedAt(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().slice(0, ISO_DATE_LENGTH);
}

function RealStorageBindingRow({
  binding,
  onEdit,
  onDelete,
}: IRealStorageBindingRowProps): React.JSX.Element {
  const { t } = useTranslation();
  const config = binding.config ?? {};
  const bucket = typeof config.bucket === "string" ? config.bucket : "—";
  const projectId = typeof config.projectId === "string" ? config.projectId : "—";

  return (
    <div className="border-border/40 flex items-start justify-between gap-3 border-b px-5 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[12.5px] font-semibold">{binding.name}</div>
        <div className="text-muted-foreground mt-1 grid grid-cols-1 gap-x-3 gap-y-0.5 font-mono text-[11px] sm:grid-cols-3">
          <span className="truncate">
            <span className="text-muted-foreground/80">
              {t("pages.system.storageBindings.real.bucket")}:
            </span>{" "}
            {bucket}
          </span>
          <span className="truncate">
            <span className="text-muted-foreground/80">
              {t("pages.system.storageBindings.real.projectId")}:
            </span>{" "}
            {projectId}
          </span>
          <span className="truncate">
            <span className="text-muted-foreground/80">
              {t("pages.system.storageBindings.real.createdAt")}:
            </span>{" "}
            {formatCreatedAt(binding.createdAt)}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            onEdit(binding);
          }}
        >
          <Pencil size={ICON_XS} />
          {t("pages.system.storageBindings.edit")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            onDelete(binding);
          }}
        >
          <Trash2 size={ICON_XS} />
          {t("pages.system.storageBindings.delete")}
        </Button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────

export function SystemPage(): React.JSX.Element {
  const { t } = useTranslation();
  const bindingsQuery = useStorageBindings();
  const bindings: StorageBindingResponseDTO[] = bindingsQuery.data ?? [];

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create");
  const [editingBinding, setEditingBinding] = useState<StorageBindingResponseDTO | undefined>(
    undefined,
  );

  const [deletingBinding, setDeletingBinding] = useState<StorageBindingResponseDTO | undefined>(
    undefined,
  );

  function openCreateDrawer(): void {
    setDrawerMode("create");
    setEditingBinding(undefined);
    setDrawerOpen(true);
  }

  function openEditDrawer(binding: StorageBindingResponseDTO): void {
    setDrawerMode("edit");
    setEditingBinding(binding);
    setDrawerOpen(true);
  }

  function closeDrawer(): void {
    setDrawerOpen(false);
  }

  function openDeleteDialog(binding: StorageBindingResponseDTO): void {
    setDeletingBinding(binding);
  }

  function closeDeleteDialog(): void {
    setDeletingBinding(undefined);
  }

  const overallStatus: "ok" | "warn" | "degraded" = DEMO_QUEUES.some((q) => q.trend === "alert")
    ? "degraded"
    : DEMO_QUEUES.some((q) => q.trend === "warn")
      ? "warn"
      : "ok";

  const hasRealBindings = bindings.length > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-[22px] font-bold tracking-tight">{t("pages.system.title")}</h1>
          <div className="text-muted-foreground mt-1 text-[12.5px]">
            {t("pages.system.subtitle")}
          </div>
        </div>
        <Button variant="outline">
          <ExternalLink size={ICON_SM} />
          {t("pages.system.publicStatusPage")}
        </Button>
      </div>

      {/* Banner */}
      <StatusBanner status={overallStatus} />

      {/* Pipelines */}
      <Card className="mb-4 overflow-x-auto">
        <CardHeader>
          <CardTitle>{t("pages.system.pipelines.title")}</CardTitle>
          <CardMeta>{t("pages.system.pipelines.meta")}</CardMeta>
        </CardHeader>
        <div className="min-w-[820px]">
          <div className="border-border/60 text-muted-foreground grid grid-cols-[140px_1fr_90px_90px_90px_60px] items-center gap-3 border-b px-5 py-2 text-[10.5px] font-medium tracking-wider uppercase">
            <span>{t("pages.system.pipelines.stage")}</span>
            <span>{t("pages.system.pipelines.throughput")}</span>
            <span className="text-right">{t("pages.system.pipelines.inflight")}</span>
            <span className="text-right">{t("pages.system.pipelines.queued")}</span>
            <span className="text-right">{t("pages.system.pipelines.p95")}</span>
            <span />
          </div>
          {DEMO_QUEUES.map((q) => (
            <PipelineRow key={q.name} q={q} />
          ))}
        </div>
      </Card>

      {/* Storage + deps 2-col */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Storage */}
        <Card>
          <CardHeader>
            <CardTitle>
              {t("pages.system.storageBindings.title")}
              {!hasRealBindings ? (
                <span className="text-muted-foreground ml-2 text-[10.5px] font-normal">
                  {t("pages.system.storageBindings.demoLabel")}
                </span>
              ) : null}
            </CardTitle>
            <div className="ml-auto flex items-center gap-2">
              <CardMeta className="ml-0">{t("pages.system.storage.meta")}</CardMeta>
              <Button type="button" variant="outline" size="sm" onClick={openCreateDrawer}>
                <Plus size={ICON_XS} />
                {t("pages.system.storageBindings.addBinding")}
              </Button>
            </div>
          </CardHeader>
          {hasRealBindings ? (
            <div className="py-1">
              {bindings.map((binding) => (
                <RealStorageBindingRow
                  key={binding.name}
                  binding={binding}
                  onEdit={openEditDrawer}
                  onDelete={openDeleteDialog}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-3 px-5 py-4">
              {DEMO_STORAGE_BINDINGS.map((b) => (
                <div key={b.name}>
                  <div className="flex justify-between text-[12px]">
                    <span className="font-mono">{b.name}</span>
                    <span className="text-muted-foreground font-mono">{b.delta}</span>
                  </div>
                  <div className="bg-secondary mt-1 h-2 overflow-hidden rounded">
                    <div
                      className={cn(
                        "h-full",
                        b.pct > PROGRESS_ALERT
                          ? "bg-alert"
                          : b.pct > PROGRESS_WARN
                            ? "bg-warn"
                            : "bg-latam-indigo",
                      )}
                      style={{ width: `${b.pct}%` }}
                    />
                  </div>
                  <div className="text-muted-foreground mt-1 flex justify-between font-mono text-[10.5px]">
                    <span>{b.region}</span>
                    <span>
                      {b.used} / {b.quota}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Dependencies */}
        <Card>
          <CardHeader>
            <CardTitle>{t("pages.system.dependencies.title")}</CardTitle>
          </CardHeader>
          <div className="px-5 py-4">
            {DEMO_DEPS.map((dep) => (
              <div
                key={dep.name}
                className="border-border/40 flex items-center gap-3 border-b py-2.5 last:border-b-0"
              >
                <span
                  className={cn(
                    "size-2 flex-none rounded-full",
                    dep.status === "ok" ? "bg-ok" : dep.status === "warn" ? "bg-warn" : "bg-alert",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[12.5px]">{dep.name}</div>
                  <div className="text-muted-foreground text-[10.5px]">{dep.note}</div>
                </div>
                <div className="text-muted-foreground font-mono text-[11px] tabular-nums">
                  {dep.latency}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Worker fleet */}
      <Card>
        <CardHeader>
          <CardTitle>{t("pages.system.workers.title")}</CardTitle>
          <CardMeta>{t("pages.system.workers.meta", { count: DEMO_WORKERS.length })}</CardMeta>
        </CardHeader>
        <div className="grid grid-cols-2 gap-2 px-5 py-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {DEMO_WORKERS.map((worker) => (
            <WorkerCard key={worker.id} w={worker} />
          ))}
        </div>
      </Card>

      {/* Drawer + delete dialog */}
      <StorageBindingDrawer
        open={drawerOpen}
        mode={drawerMode}
        binding={editingBinding}
        onClose={closeDrawer}
      />
      <DeleteStorageBindingDialog
        open={deletingBinding !== undefined}
        binding={deletingBinding}
        onClose={closeDeleteDialog}
      />
    </div>
  );
}
