import type { QuarantinedAssetResponseDTO } from "@shared/backend-api";
import { Check, Download, Flag, Image as ImageIcon, Shield, X } from "lucide-react";
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Card, CardHeader, CardMeta, CardTitle } from "@/components/common/Card";
import { RelativeTime } from "@/components/common/RelativeTime";
import { StatePill } from "@/components/common/StatePill";
import { useQuarantine } from "@/features/quarantine/hooks/useQuarantine";
import {
  useRejectQuarantinedAsset,
  useReleaseQuarantinedAsset,
} from "@/features/quarantine/hooks/useQuarantineMutations";
import { cn, fmtBytes } from "@/lib/utils";

const ICON_XS = 10;
const ICON_SM = 11;
const ICON_MD = 13;
const ICON_LG = 24;
const REJECT_MIN_CHARS = 12;
const TOAST_DURATION_MS = 2800;
const QUEUE_FETCH_LIMIT = 100;
const PUBLIC_ID_PREVIEW_CHARS = 8;

type IFilterType = "all" | "moderation" | "virus" | "invalid_format";
type QuarantineKind = "moderation" | "virus" | "invalid_format";

interface IToast {
  kind: "ok" | "alert";
  msg: string;
}

function shortReason(asset: QuarantinedAssetResponseDTO, t: (key: string) => string): string {
  if (asset.quarantineKind === "invalid_format") {
    return asset.stateReason ?? t("pages.quarantine.shortReason.invalidFormat");
  }
  if (asset.quarantineKind === "virus") {
    return asset.flaggedCategory ?? t("pages.quarantine.shortReason.virus");
  }
  return asset.flaggedCategory ?? t("pages.quarantine.shortReason.moderation");
}

// ── Reject modal ──────────────────────────────────────────

interface IRejectModalProps {
  onClose: () => void;
  onConfirm: (note: string) => void;
}

function RejectModal({ onClose, onConfirm }: IRejectModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const [note, setNote] = useState("");
  const titleId = useId();

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className="bg-foreground/30 fixed inset-0 z-40 grid place-items-center backdrop-blur-sm"
      onClick={onClose}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="border-border bg-card w-[440px] rounded-lg border shadow-2xl"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="border-border flex items-center justify-between border-b px-5 py-3">
          <div id={titleId} className="flex items-center gap-2 text-[14px] font-semibold">
            <X size={ICON_MD} className="text-danger" />
            {t("pages.quarantine.rejectModal.title")}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X size={ICON_MD} />
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-muted-foreground m-0 text-[12.5px]">
            {t("pages.quarantine.rejectModal.description")}
          </p>
          <div className="mt-3">
            <label className="text-foreground mb-1 block text-[11.5px] font-medium">
              {t("pages.quarantine.rejectModal.noteLabel")}
            </label>
            <textarea
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
              }}
              placeholder={t("pages.quarantine.rejectModal.notePlaceholder")}
              rows={3}
              className="border-input placeholder:text-muted-foreground focus:ring-latam-indigo/50 mt-1 w-full rounded-md border bg-transparent px-3 py-2 text-[12.5px] outline-none focus:ring-1"
            />
          </div>
        </div>
        <div className="border-border bg-secondary/30 flex justify-end gap-2 border-t px-5 py-3">
          <Button variant="outline" onClick={onClose}>
            {t("pages.quarantine.rejectModal.cancel")}
          </Button>
          <Button
            variant="danger"
            disabled={note.length < REJECT_MIN_CHARS}
            onClick={() => {
              onConfirm(note);
            }}
          >
            <X size={ICON_MD} />
            {t("pages.quarantine.rejectModal.confirm")}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Detail pane ───────────────────────────────────────────

interface IDetailFieldProps {
  label: string;
  children: React.ReactNode;
}

function DetailField({ label, children }: IDetailFieldProps): React.JSX.Element {
  return (
    <div>
      <div className="text-muted-foreground text-[10.5px] tracking-wider uppercase">{label}</div>
      <div className="mt-1 font-mono text-[11.5px]">{children}</div>
    </div>
  );
}

interface IInvalidFormatVerdictProps {
  asset: QuarantinedAssetResponseDTO;
}

function InvalidFormatVerdict({ asset }: IInvalidFormatVerdictProps): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="border-warn-line bg-warn-soft text-warn rounded-md border px-3 py-2.5 text-[12px]">
      <div className="font-semibold">{t("pages.quarantine.verdict.invalidFormat.title")}</div>
      <div className="mt-1 font-mono text-[11.5px]">
        {asset.stateReason ?? t("pages.quarantine.verdict.invalidFormat.fallback")}
      </div>
    </div>
  );
}

interface IFlaggedAnalyzerVerdictProps {
  asset: QuarantinedAssetResponseDTO;
}

function FlaggedAnalyzerVerdict({ asset }: IFlaggedAnalyzerVerdictProps): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="border-alert-line bg-alert-soft text-alert rounded-md border px-3 py-2.5 text-[12px]">
      <div className="font-semibold">
        {asset.quarantineKind === "virus"
          ? t("pages.quarantine.verdict.virus.title")
          : t("pages.quarantine.verdict.moderation.title")}
      </div>
      <div className="text-muted-foreground mt-1 font-mono text-[11.5px]">
        {asset.flaggedAnalyzer
          ? `${asset.flaggedAnalyzer}${asset.flaggedCategory ? ` · ${asset.flaggedCategory}` : ""}`
          : t("pages.quarantine.verdict.pendingAnalyzer")}
      </div>
    </div>
  );
}

interface IDetailPaneProps {
  asset: QuarantinedAssetResponseDTO;
  onRelease: () => void;
  onReject: () => void;
  busy: boolean;
}

function DetailPane({ asset, onRelease, onReject, busy }: IDetailPaneProps): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{asset.publicId}</CardTitle>
          <CardMeta>
            <span className="font-mono">{asset.namespaceSlug}</span>
            {" · "}
            <RelativeTime iso={asset.flaggedAt} />
          </CardMeta>
        </CardHeader>

        <div className="space-y-4 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2 text-[11.5px]">
            <StatePill state={asset.state} />
            <Badge variant="muted">{t("pages.quarantine.policyBadge")}</Badge>
            {asset.legalHold ? (
              <Badge variant="warn">
                <Shield size={ICON_XS} />
                {t("pages.quarantine.legalHold")}
              </Badge>
            ) : null}
          </div>

          {asset.quarantineKind === "invalid_format" ? (
            <InvalidFormatVerdict asset={asset} />
          ) : (
            <FlaggedAnalyzerVerdict asset={asset} />
          )}

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <DetailField label={t("pages.quarantine.detail.declaredMime")}>
              {asset.declaredMimeType ?? "—"}
            </DetailField>
            <DetailField label={t("pages.quarantine.detail.size")}>
              {typeof asset.sizeBytes === "number" ? fmtBytes(asset.sizeBytes) : "—"}
            </DetailField>
            <DetailField label={t("pages.quarantine.detail.dimensions")}>
              {typeof asset.width === "number" && typeof asset.height === "number"
                ? `${String(asset.width)} × ${String(asset.height)}`
                : "—"}
            </DetailField>
            <DetailField label={t("pages.quarantine.detail.uploadedBy")}>
              {asset.uploadedBy ?? "—"}
            </DetailField>
            <DetailField label={t("pages.quarantine.detail.externalRef")}>
              {asset.externalRefType && asset.externalRefId
                ? `${asset.externalRefType}: ${asset.externalRefId}`
                : "—"}
            </DetailField>
            <DetailField label={t("pages.quarantine.detail.flaggedAt")}>
              {asset.flaggedAt ? new Date(asset.flaggedAt).toLocaleString() : "—"}
            </DetailField>
          </div>

          {asset.tags && asset.tags.length > 0 ? (
            <div>
              <div className="text-muted-foreground text-[10.5px] tracking-wider uppercase">
                {t("pages.quarantine.detail.tags")}
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {asset.tags.map((tag) => (
                  <span
                    key={tag}
                    className="border-border bg-muted/40 text-foreground/90 rounded-full border px-2.5 py-0.5 text-[11px]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-border bg-secondary/30 border-t px-5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="pink" size="sm" onClick={onRelease} disabled={busy}>
              <Check size={ICON_MD} />
              {t("pages.quarantine.actions.release")}
            </Button>
            <Button variant="danger" size="sm" onClick={onReject} disabled={busy}>
              <X size={ICON_MD} />
              {t("pages.quarantine.actions.reject")}
            </Button>
            <Button variant="outline" size="sm" disabled={busy}>
              <Flag size={ICON_MD} />
              {t("pages.quarantine.actions.escalate")}
            </Button>
          </div>
          <div className="text-muted-foreground mt-2 text-[10.5px]">
            {t("pages.quarantine.decisionNote")}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────

export function QuarantinePage(): React.JSX.Element {
  const { t } = useTranslation();
  const { data, isLoading } = useQuarantine({ page: 1, limit: QUEUE_FETCH_LIMIT });
  const allAssets: QuarantinedAssetResponseDTO[] = useMemo(() => data?.data ?? [], [data]);

  const releaseMutation = useReleaseQuarantinedAsset();
  const rejectMutation = useRejectQuarantinedAsset();
  const mutating = releaseMutation.isPending || rejectMutation.isPending;

  const [filter, setFilter] = useState<IFilterType>("all");
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [reviewedToday, setReviewedToday] = useState(0);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [toast, setToast] = useState<IToast | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cancel any pending toast timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const filtered: QuarantinedAssetResponseDTO[] = useMemo(() => {
    return allAssets.filter((a) => filter === "all" || a.quarantineKind === filter);
  }, [allAssets, filter]);

  // The "selected item" is derived from the filtered list. If the user hasn't
  // clicked anything yet (or their previous selection is now filtered out),
  // we fall through to the first row. We deliberately don't sync `selectedId`
  // back via an effect — derived-only avoids a render cascade.
  const selected = filtered.find((a) => a.publicId === selectedId) ?? filtered[0];

  const showToast = useCallback((kind: "ok" | "alert", msg: string): void => {
    setToast({ kind, msg });
    if (toastTimerRef.current !== null) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, TOAST_DURATION_MS);
  }, []);

  const release = useCallback(
    (note?: string): void => {
      if (!selected) return;
      const { publicId } = selected;
      releaseMutation.mutate(
        { publicId, note },
        {
          onSuccess: () => {
            setReviewedToday((prev) => prev + 1);
            showToast("ok", t("pages.quarantine.toast.released", { id: publicId }));
          },
          onError: (err) => {
            showToast(
              "alert",
              t("pages.quarantine.toast.releaseFailed", { id: publicId, error: err.message }),
            );
          },
        },
      );
    },
    [releaseMutation, selected, showToast, t],
  );

  const reject = useCallback(
    (note: string): void => {
      if (!selected) return;
      const { publicId } = selected;
      rejectMutation.mutate(
        { publicId, note },
        {
          onSuccess: () => {
            setReviewedToday((prev) => prev + 1);
            showToast("alert", t("pages.quarantine.toast.rejected", { id: publicId }));
          },
          onError: (err) => {
            showToast(
              "alert",
              t("pages.quarantine.toast.rejectFailed", { id: publicId, error: err.message }),
            );
          },
        },
      );
    },
    [rejectMutation, selected, showToast, t],
  );

  // Keyboard shortcuts (j/k navigate, a release, r reject). We index off
  // `selected` rather than `selectedId` so j/k still work on first load,
  // before the user has clicked anything (selectedId is undefined but
  // `selected` falls through to filtered[0]).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.target as HTMLElement).matches("input, textarea")) return;
      if (!selected) return;
      const currentIdx = filtered.findIndex((a) => a.publicId === selected.publicId);
      if (e.key === "j") {
        const next = filtered[Math.min(filtered.length - 1, currentIdx + 1)];
        if (next) setSelectedId(next.publicId);
      } else if (e.key === "k") {
        const prev = filtered[Math.max(0, currentIdx - 1)];
        if (prev) setSelectedId(prev.publicId);
      } else if (e.key === "a") {
        if (!mutating) release();
      } else if (e.key === "r") {
        if (!mutating) setShowRejectModal(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [filtered, selected, release, mutating]);

  const counts: Record<QuarantineKind, number> = useMemo(() => {
    return {
      moderation: allAssets.filter((a) => a.quarantineKind === "moderation").length,
      virus: allAssets.filter((a) => a.quarantineKind === "virus").length,
      invalid_format: allAssets.filter((a) => a.quarantineKind === "invalid_format").length,
    };
  }, [allAssets]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-[22px] font-bold tracking-tight">
            {t("pages.quarantine.title")}
          </h1>
          <div className="text-muted-foreground mt-1 text-[12.5px]">
            <b className="text-foreground">{filtered.length}</b>{" "}
            {t("pages.quarantine.subtitle.awaitingReview")}{" "}
            <span className="text-warn">{t("pages.quarantine.subtitle.slo")}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="ok">
            <Check size={ICON_SM} />
            {t("pages.quarantine.reviewedToday", { count: reviewedToday })}
          </Badge>
          <Button variant="outline">
            <Download size={ICON_MD} />
            {t("pages.quarantine.exportQueue")}
          </Button>
        </div>
      </div>

      {/* Filter strip */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="border-border bg-card inline-flex rounded-md border p-0.5 text-[12px]">
          {(
            [
              {
                id: "all" as IFilterType,
                label: t("pages.quarantine.filters.all"),
                count: counts.moderation + counts.virus + counts.invalid_format,
              },
              {
                id: "moderation" as IFilterType,
                label: t("pages.quarantine.filters.moderation"),
                count: counts.moderation,
              },
              {
                id: "virus" as IFilterType,
                label: t("pages.quarantine.filters.virus"),
                count: counts.virus,
              },
              {
                id: "invalid_format" as IFilterType,
                label: t("pages.quarantine.filters.invalidFormat"),
                count: counts.invalid_format,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setFilter(tab.id);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded px-2.5 py-1 transition-colors",
                filter === tab.id
                  ? "bg-latam-indigo text-white"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10.5px] tabular-nums",
                  filter === tab.id
                    ? "bg-white/25 text-white"
                    : "bg-secondary text-muted-foreground",
                )}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Keyboard hints */}
        <div className="text-muted-foreground ml-auto flex items-center gap-2 text-[11.5px]">
          <span>{t("pages.quarantine.keys.label")}</span>
          <kbd className="border-border bg-secondary rounded border px-1.5 py-0.5 font-mono text-[10.5px]">
            J
          </kbd>
          <span>{t("pages.quarantine.keys.next")}</span>
          <kbd className="border-border bg-secondary rounded border px-1.5 py-0.5 font-mono text-[10.5px]">
            K
          </kbd>
          <span>{t("pages.quarantine.keys.prev")}</span>
          <kbd className="border-border bg-secondary rounded border px-1.5 py-0.5 font-mono text-[10.5px]">
            A
          </kbd>
          <span>{t("pages.quarantine.keys.release")}</span>
          <kbd className="border-border bg-secondary rounded border px-1.5 py-0.5 font-mono text-[10.5px]">
            R
          </kbd>
          <span>{t("pages.quarantine.keys.reject")}</span>
        </div>
      </div>

      {/* Two-pane layout */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
        {/* Queue list */}
        <Card className="max-h-[calc(100vh-220px)] overflow-y-auto p-0">
          {isLoading ? (
            <div className="text-muted-foreground px-6 py-12 text-center text-[12.5px]">
              {t("pages.quarantine.loading")}
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="bg-ok-soft text-ok mx-auto mb-2 grid size-12 place-items-center rounded-full">
                <Check size={20} />
              </div>
              <div className="text-[14px] font-medium">{t("pages.quarantine.allClear.title")}</div>
              <div className="text-muted-foreground mt-1 text-[12.5px]">
                {t("pages.quarantine.allClear.description")}
              </div>
            </div>
          ) : (
            filtered.map((asset) => (
              <button
                key={asset.publicId}
                type="button"
                aria-current={selected?.publicId === asset.publicId ? "true" : undefined}
                onClick={() => {
                  setSelectedId(asset.publicId);
                }}
                className={cn(
                  "border-border/60 flex w-full gap-3 border-b px-3 py-2.5 text-left transition-colors",
                  selected?.publicId === asset.publicId
                    ? "border-l-latam-indigo bg-latam-indigo/[0.08] border-l-2"
                    : "hover:bg-secondary/40",
                )}
              >
                <div className="border-border bg-secondary text-muted-foreground grid h-12 w-16 flex-none place-items-center rounded border">
                  <ImageIcon size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-foreground truncate font-mono text-[11.5px]">
                      {asset.publicId.slice(0, PUBLIC_ID_PREVIEW_CHARS)}…
                    </span>
                    <RelativeTime
                      iso={asset.flaggedAt}
                      className="text-muted-foreground font-mono text-[10.5px]"
                    />
                  </div>
                  <div className="text-alert mt-0.5 line-clamp-1 text-[11.5px]">
                    {shortReason(asset, t)}
                  </div>
                  <div className="text-muted-foreground mt-0.5 flex items-center justify-between text-[10.5px]">
                    <span className="truncate font-mono">{asset.namespaceSlug}</span>
                    <span>
                      {typeof asset.sizeBytes === "number" ? fmtBytes(asset.sizeBytes) : "—"}
                    </span>
                  </div>
                </div>
              </button>
            ))
          )}
        </Card>

        {/* Detail pane */}
        {!selected ? (
          <Card className="grid place-items-center px-8 py-24 text-center">
            <div>
              <div className="bg-ok-soft text-ok mx-auto mb-3 grid size-14 place-items-center rounded-full">
                <Check size={ICON_LG} />
              </div>
              <div className="text-[16px] font-semibold">
                {t("pages.quarantine.queueEmpty.title")}
              </div>
              <div className="text-muted-foreground mt-1 text-[12.5px]">
                {t("pages.quarantine.queueEmpty.description")}
              </div>
            </div>
          </Card>
        ) : (
          <DetailPane
            asset={selected}
            busy={mutating}
            onRelease={() => {
              release();
            }}
            onReject={() => {
              setShowRejectModal(true);
            }}
          />
        )}
      </div>

      {/* Reject modal */}
      {showRejectModal && (
        <RejectModal
          onClose={() => {
            setShowRejectModal(false);
          }}
          onConfirm={(note) => {
            reject(note);
            setShowRejectModal(false);
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className={cn(
            "fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md border px-4 py-2.5 shadow-xl",
            toast.kind === "ok"
              ? "border-ok-line bg-ok-soft text-ok"
              : "border-alert-line bg-alert-soft text-alert",
          )}
        >
          <div className="flex items-center gap-2 text-[12.5px] font-medium">
            {toast.kind === "ok" ? <Check size={ICON_MD} /> : <X size={ICON_MD} />}
            {toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}
