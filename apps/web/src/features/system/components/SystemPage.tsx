// SystemPage reads real storage bindings via the BE. The pipeline / worker
// cards render an empty state until those telemetry slices land.
import type { StorageBindingResponseDTO } from "@shared/backend-api";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/common/Button";
import { Card, CardHeader, CardMeta, CardTitle } from "@/components/common/Card";
import { DeleteStorageBindingDialog } from "@/features/system/components/DeleteStorageBindingDialog";
import { StorageBindingDrawer } from "@/features/system/components/StorageBindingDrawer";
import { useStorageBindings } from "@/features/system/hooks/useSystem";
import { cn } from "@/lib/utils";

// ── Constants ─────────────────────────────────────────────
const ICON_SM = 13;
const ICON_XS = 12;
const ISO_DATE_LENGTH = 10;

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

  const overallStatus: "ok" | "warn" | "degraded" = "ok";

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

      {/* Storage */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>{t("pages.system.storageBindings.title")}</CardTitle>
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
          <div className="text-muted-foreground px-5 py-8 text-center text-[12.5px]">
            {t("pages.system.noStorageBindings")}
          </div>
        )}
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
