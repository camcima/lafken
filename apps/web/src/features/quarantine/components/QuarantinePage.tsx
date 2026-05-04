// Slice 0: BE returns empty arrays; rendering against typed demo data
import { Check, Download, ExternalLink, Flag, Info, Shield, X } from "lucide-react";
import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Card, CardContent, CardHeader, CardMeta, CardTitle } from "@/components/common/Card";
import { SELECT_CLASS } from "@/components/common/select-styles";
import { StatePill } from "@/components/common/StatePill";
import { DEMO_QUARANTINE, type DemoQuarantineItem, fmtMinAgo } from "@/lib/demo/lafken-demo-data";
import { cn } from "@/lib/utils";

// ── Icon sizes ────────────────────────────────────────────
const ICON_XS = 10;
const ICON_SM = 11;
const ICON_MD = 13;
const ICON_LG = 24;
const SHIELD_SM = 12;
const SHIELD_LG = 28;

// ── Numeric constants ─────────────────────────────────────
const BYTES_PER_MB = 1_048_576;
const SCORE_DECIMAL_PLACES = 3;

// ── Thumbnail ─────────────────────────────────────────────

interface IThumbProps {
  item: DemoQuarantineItem;
  large?: boolean;
}

function Thumb({ item, large }: IThumbProps): React.JSX.Element {
  return (
    <div
      className={cn(
        "border-border relative overflow-hidden rounded border",
        large ? "aspect-[4/3] w-full" : "h-12 w-16",
      )}
      style={{
        background: `linear-gradient(135deg, hsl(${item.thumbHue} 50% 55%), hsl(${item.thumbHue} 60% 35%))`,
      }}
    >
      <span
        className={cn(
          "absolute inset-0 grid place-items-center font-bold tracking-wider text-white uppercase",
          "bg-[repeating-linear-gradient(45deg,rgba(139,39,26,0.78)_0_8px,rgba(139,39,26,0.55)_8px_16px)]",
          large ? "text-[14px]" : "text-[9px]",
        )}
      >
        {large ? <Shield size={SHIELD_LG} /> : <Shield size={SHIELD_SM} />}
      </span>
      {large && (
        <span className="absolute bottom-3 left-3 rounded bg-black/55 px-2 py-1 font-mono text-[10.5px] tracking-wider text-white uppercase">
          {item.category}
        </span>
      )}
    </div>
  );
}

// ── Score bars ────────────────────────────────────────────

const SCORE_PERCENT = 100;
const DEFAULT_THRESHOLD = 0.65;
const DEFAULT_VIOLENCE_SCORE = 0.04;
const DEFAULT_MEDICAL_SCORE = 0.18;
const DEFAULT_ADULT_SCORE = 0.001;
const DEFAULT_RACY_SCORE = 0.012;

interface ICategoryBar {
  label: string;
  value: number;
  threshold: number;
}

function CategoryBars({ selected }: { selected: DemoQuarantineItem }): React.JSX.Element {
  const { t } = useTranslation();
  const bars: ICategoryBar[] = [
    {
      label: "violence",
      value: selected.category === "violence" ? selected.score : DEFAULT_VIOLENCE_SCORE,
      threshold: DEFAULT_THRESHOLD,
    },
    {
      label: "medical",
      value: selected.category === "medical" ? selected.score : DEFAULT_MEDICAL_SCORE,
      threshold: DEFAULT_THRESHOLD,
    },
    {
      label: "adult",
      value: selected.category === "adult" ? selected.score : DEFAULT_ADULT_SCORE,
      threshold: DEFAULT_THRESHOLD,
    },
    {
      label: "gore",
      value: selected.category === "gore" ? selected.score : 0.0,
      threshold: DEFAULT_THRESHOLD,
    },
    { label: "racy", value: DEFAULT_RACY_SCORE, threshold: DEFAULT_THRESHOLD },
    { label: "self_harm", value: 0.0, threshold: DEFAULT_THRESHOLD },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("pages.quarantine.flagged.title")}</CardTitle>
        <CardMeta>{t("pages.quarantine.flagged.meta")}</CardMeta>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 p-5">
        {bars.map((bar) => (
          <div key={bar.label}>
            <div className="flex justify-between font-mono text-[11.5px]">
              <span className="text-muted-foreground">{bar.label}</span>
              <span
                className={cn(
                  bar.value >= bar.threshold ? "text-alert font-medium" : "text-muted-foreground",
                )}
              >
                {bar.value.toFixed(SCORE_DECIMAL_PLACES)}
              </span>
            </div>
            <div className="bg-secondary relative mt-1 h-1.5 overflow-hidden rounded">
              <div
                className={cn(
                  "h-full",
                  bar.value >= bar.threshold ? "bg-alert" : "bg-latam-indigo/50",
                )}
                style={{ width: `${Math.min(SCORE_PERCENT, bar.value * SCORE_PERCENT)}%` }}
              />
              <div
                className="bg-foreground/40 absolute top-0 h-full w-px"
                style={{ left: `${bar.threshold * SCORE_PERCENT}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ── Reject modal ──────────────────────────────────────────

interface IRejectModalProps {
  onClose: () => void;
  onConfirm: (note: string) => void;
}

const REJECT_MIN_CHARS = 12;

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

// ── Types ─────────────────────────────────────────────────

interface IDecision {
  decision: "release" | "reject";
  note: string;
  at: number;
}

interface IToast {
  kind: "ok" | "alert";
  msg: string;
}

type IFilterType = "all" | "moderation" | "virus";

const TOAST_DURATION_MS = 2800;

// ── Uploader history demo constants ───────────────────────
const DEMO_UPLOADER_HISTORY = {
  uploaded: 412,
  flagged: 3,
  flagRate: "0.7%",
} as const;

// ── Main page ─────────────────────────────────────────────

export function QuarantinePage(): React.JSX.Element {
  const { t } = useTranslation();

  const [filter, setFilter] = useState<IFilterType>("all");
  const [reasonFilter, setReasonFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | undefined>(DEMO_QUARANTINE[0]?.id);
  const [decided, setDecided] = useState<Record<string, IDecision>>({});
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

  const filtered = DEMO_QUARANTINE.filter((a) => {
    if (decided[a.id]) return false;
    if (filter === "moderation" && a.state !== "quarantined_moderation") return false;
    if (filter === "virus" && a.state !== "quarantined_virus") return false;
    if (reasonFilter !== "all" && a.category !== reasonFilter) return false;
    return true;
  });

  const selected = filtered.find((a) => a.id === selectedId) ?? filtered[0];

  const decide = useCallback(
    (decision: "release" | "reject", note = "") => {
      if (!selected) return;
      setDecided((prev) => ({ ...prev, [selected.id]: { decision, note, at: Date.now() } }));
      setToast({
        kind: decision === "release" ? "ok" : "alert",
        msg:
          decision === "release"
            ? t("pages.quarantine.toast.released", { id: selected.id })
            : t("pages.quarantine.toast.rejected", { id: selected.id }),
      });
      if (toastTimerRef.current !== null) {
        clearTimeout(toastTimerRef.current);
      }
      toastTimerRef.current = setTimeout(() => {
        setToast(null);
        toastTimerRef.current = null;
      }, TOAST_DURATION_MS);
      // Compute next selection from the post-decision filtered list
      const remaining = filtered.filter((a) => a.id !== selected.id);
      const idx = filtered.findIndex((a) => a.id === selected.id);
      const next = remaining[idx] ?? remaining[idx - 1] ?? null;
      setSelectedId(next?.id ?? undefined);
    },
    [selected, filtered, t],
  );

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.target as HTMLElement).matches("input, textarea")) return;
      if (e.key === "j") {
        const idx = filtered.findIndex((a) => a.id === selectedId);
        const next = filtered[Math.min(filtered.length - 1, idx + 1)];
        if (next) setSelectedId(next.id);
      } else if (e.key === "k") {
        const idx = filtered.findIndex((a) => a.id === selectedId);
        const prev = filtered[Math.max(0, idx - 1)];
        if (prev) setSelectedId(prev.id);
      } else if (e.key === "a" && selected) {
        decide("release");
      } else if (e.key === "r" && selected) {
        setShowRejectModal(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [filtered, selectedId, selected, decide]);

  const moderationCount = DEMO_QUARANTINE.filter(
    (a) => a.state === "quarantined_moderation" && !decided[a.id],
  ).length;
  const virusCount = DEMO_QUARANTINE.filter(
    (a) => a.state === "quarantined_virus" && !decided[a.id],
  ).length;
  const reviewedToday = Object.keys(decided).length;

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
        {/* Tab toggle */}
        <div className="border-border bg-card inline-flex rounded-md border p-0.5 text-[12px]">
          {(
            [
              {
                id: "all" as IFilterType,
                label: t("pages.quarantine.filters.all"),
                count: moderationCount + virusCount,
              },
              {
                id: "moderation" as IFilterType,
                label: t("pages.quarantine.filters.moderation"),
                count: moderationCount,
              },
              {
                id: "virus" as IFilterType,
                label: t("pages.quarantine.filters.virus"),
                count: virusCount,
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

        {/* Reason select */}
        <select
          value={reasonFilter}
          onChange={(e) => {
            setReasonFilter(e.target.value);
          }}
          className={SELECT_CLASS}
        >
          <option value="all">{t("pages.quarantine.reasons.all")}</option>
          <option value="violence">{t("pages.quarantine.reasons.violence")}</option>
          <option value="medical">{t("pages.quarantine.reasons.medical")}</option>
          <option value="adult">{t("pages.quarantine.reasons.adult")}</option>
          <option value="gore">{t("pages.quarantine.reasons.gore")}</option>
          <option value="virus">{t("pages.quarantine.reasons.virus")}</option>
        </select>

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
          {filtered.length === 0 ? (
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
            filtered.map((a) => (
              <button
                key={a.id}
                type="button"
                aria-current={selected?.id === a.id ? "true" : undefined}
                onClick={() => {
                  setSelectedId(a.id);
                }}
                className={cn(
                  "border-border/60 flex w-full gap-3 border-b px-3 py-2.5 text-left transition-colors",
                  selected?.id === a.id
                    ? "border-l-latam-indigo bg-latam-indigo/[0.08] border-l-2"
                    : "hover:bg-secondary/40",
                )}
              >
                <Thumb item={a} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-foreground font-mono text-[11.5px]">{a.id}</span>
                    <span className="text-muted-foreground font-mono text-[10.5px]">
                      {fmtMinAgo(a.minutesAgo)}
                    </span>
                  </div>
                  <div className="text-alert mt-0.5 text-[11.5px]">{a.reason}</div>
                  <div className="text-muted-foreground mt-0.5 flex items-center justify-between text-[10.5px]">
                    <span className="truncate font-mono">{a.namespace}</span>
                    <span>{(a.sizeBytes / BYTES_PER_MB).toFixed(1)}&nbsp;MB</span>
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
          <div className="space-y-4">
            {/* Decision card */}
            <Card>
              <div className="grid grid-cols-1 gap-0 xl:grid-cols-[minmax(0,1fr)_360px]">
                {/* Thumbnail side */}
                <div className="border-border border-b p-5 xl:border-r xl:border-b-0">
                  <Thumb item={selected} large />
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11.5px]">
                    <StatePill state={selected.state} />
                    <Badge variant="muted">{t("pages.quarantine.policyBadge")}</Badge>
                    <span className="text-muted-foreground font-mono">{selected.namespace}</span>
                  </div>
                </div>
                {/* Info side */}
                <div className="p-5">
                  <div className="text-muted-foreground text-[10.5px] font-medium tracking-wider uppercase">
                    {t("pages.quarantine.detail.asset")}
                  </div>
                  <div className="mt-1 font-mono text-[13px]">{selected.id}</div>
                  <div className="mt-3 grid gap-3 text-[12.5px]">
                    <div>
                      <div className="text-muted-foreground text-[10.5px] tracking-wider uppercase">
                        {t("pages.quarantine.detail.flag")}
                      </div>
                      <div className="text-alert mt-1">{selected.reason}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[10.5px] tracking-wider uppercase">
                        {t("pages.quarantine.detail.analyzer")}
                      </div>
                      <div className="mt-1 font-mono text-[11.5px]">{selected.analyzer}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[10.5px] tracking-wider uppercase">
                        {t("pages.quarantine.detail.scoreVsThreshold")}
                      </div>
                      <div className="bg-secondary mt-1.5 h-2.5 overflow-hidden rounded">
                        <div
                          className="bg-alert h-full"
                          style={{ width: `${selected.score * SCORE_PERCENT}%` }}
                        />
                      </div>
                      <div className="text-muted-foreground mt-1 flex justify-between font-mono text-[10.5px]">
                        <span>
                          {t("pages.quarantine.detail.score")}{" "}
                          <b className="text-alert">{selected.score.toFixed(2)}</b>
                        </span>
                        <span>
                          {t("pages.quarantine.detail.threshold")} {selected.threshold.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[10.5px] tracking-wider uppercase">
                        {t("pages.quarantine.detail.uploadedBy")}
                      </div>
                      <div className="mt-1 font-mono text-[11.5px]">{selected.uploadedBy}</div>
                      <div className="text-muted-foreground text-[11px]">
                        {fmtMinAgo(selected.minutesAgo)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Decision bar */}
              <div className="border-border bg-secondary/30 border-t px-5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="pink"
                    size="sm"
                    onClick={() => {
                      decide("release");
                    }}
                  >
                    <Check size={ICON_MD} />
                    {t("pages.quarantine.actions.release")}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      setShowRejectModal(true);
                    }}
                  >
                    <X size={ICON_MD} />
                    {t("pages.quarantine.actions.reject")}
                  </Button>
                  <Button variant="outline" size="sm">
                    <Flag size={ICON_MD} />
                    {t("pages.quarantine.actions.escalate")}
                  </Button>
                  <div className="ml-auto">
                    <Button variant="ghost" size="sm">
                      <ExternalLink size={ICON_XS + 2} />
                      {t("pages.quarantine.actions.openDetail")}
                    </Button>
                  </div>
                </div>
                <div className="text-muted-foreground mt-2 text-[10.5px]">
                  {t("pages.quarantine.decisionNote")}
                </div>
              </div>
            </Card>

            {/* Score bars */}
            <CategoryBars selected={selected} />

            {/* Context + uploader history */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>{t("pages.quarantine.context.title")}</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-[100px_1fr] gap-x-3 gap-y-2 p-5 text-[11.5px]">
                  {(
                    [
                      [
                        t("pages.quarantine.context.namespace"),
                        <span key="ns" className="font-mono">
                          {selected.namespace}
                        </span>,
                      ],
                      [
                        t("pages.quarantine.context.workOrder"),
                        <span key="wo" className="font-mono">
                          WO-2026-04-29-{selected.tail}-018
                        </span>,
                      ],
                      [
                        t("pages.quarantine.context.aircraft"),
                        <span key="ac" className="font-mono">
                          {selected.tail}
                        </span>,
                      ],
                      [t("pages.quarantine.context.inspectionType"), selected.inspectionType],
                      [t("pages.quarantine.context.defectArea"), selected.defectArea],
                      [t("pages.quarantine.context.capturedAt"), selected.capturedAtLocal],
                      [t("pages.quarantine.context.device"), selected.device],
                    ] as Array<[string, React.ReactNode]>
                  ).map(([rowKey, rowVal]) => (
                    <React.Fragment key={rowKey}>
                      <div className="text-muted-foreground text-[10.5px] tracking-wider uppercase">
                        {rowKey}
                      </div>
                      <div>{rowVal}</div>
                    </React.Fragment>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t("pages.quarantine.uploaderHistory.title")}</CardTitle>
                  <CardMeta>{t("pages.quarantine.uploaderHistory.meta")}</CardMeta>
                </CardHeader>
                <CardContent className="p-5 text-[12px]">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="border-border bg-secondary/30 rounded border px-2 py-3">
                      <div className="font-mono text-[20px] tabular-nums">
                        {DEMO_UPLOADER_HISTORY.uploaded}
                      </div>
                      <div className="text-muted-foreground text-[10.5px] tracking-wider uppercase">
                        {t("pages.quarantine.uploaderHistory.uploaded")}
                      </div>
                    </div>
                    <div className="border-border bg-secondary/30 rounded border px-2 py-3">
                      <div className="text-warn font-mono text-[20px] tabular-nums">
                        {DEMO_UPLOADER_HISTORY.flagged}
                      </div>
                      <div className="text-muted-foreground text-[10.5px] tracking-wider uppercase">
                        {t("pages.quarantine.uploaderHistory.flagged")}
                      </div>
                    </div>
                    <div className="border-border bg-secondary/30 rounded border px-2 py-3">
                      <div className="text-ok font-mono text-[20px] tabular-nums">
                        {DEMO_UPLOADER_HISTORY.flagRate}
                      </div>
                      <div className="text-muted-foreground text-[10.5px] tracking-wider uppercase">
                        {t("pages.quarantine.uploaderHistory.flagRate")}
                      </div>
                    </div>
                  </div>
                  <div className="border-info-line bg-info-soft text-info mt-3 rounded border px-3 py-2 text-[11.5px]">
                    <Info size={ICON_SM} className="mr-1 inline -translate-y-px" />
                    {t("pages.quarantine.uploaderHistory.note")}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Reject modal */}
      {showRejectModal && (
        <RejectModal
          onClose={() => {
            setShowRejectModal(false);
          }}
          onConfirm={(note) => {
            decide("reject", note);
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
