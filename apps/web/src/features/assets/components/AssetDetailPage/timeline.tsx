import type {
  AssetState,
  AssetStateTransitionResponseDTO,
  ProcessingJobResponseDTO,
} from "@shared/backend-api";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/common/Card/Card";
import { CardHeader } from "@/components/common/Card/CardHeader";
import { CardMeta } from "@/components/common/Card/CardMeta";
import { CardTitle } from "@/components/common/Card/CardTitle";
import { cn } from "@/lib/utils";

interface ITimelineProps {
  transitions: AssetStateTransitionResponseDTO[];
  processingJob?: ProcessingJobResponseDTO;
}

type TimelineKind = "info" | "ok" | "danger";

const TERMINAL_OK_STATES = new Set<AssetState>(["ready"]);
const TERMINAL_BAD_STATES = new Set<AssetState>([
  "rejected",
  "quarantined_virus",
  "quarantined_moderation",
  "processing_failed",
  "expired",
  "deleted",
]);

const KIND_COLOR: Record<TimelineKind, string> = {
  info: "text-info",
  ok: "text-ok",
  danger: "text-danger",
};

const KIND_SOLID: TimelineKind[] = ["ok", "danger"];

function classifyTransition(toState: AssetState): TimelineKind {
  if (TERMINAL_OK_STATES.has(toState)) return "ok";
  if (TERMINAL_BAD_STATES.has(toState)) return "danger";
  return "info";
}

export function Timeline({ transitions, processingJob }: ITimelineProps): React.JSX.Element {
  const { t } = useTranslation();
  const count: number = transitions.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("pages.assetDetail.sections.timeline")}</CardTitle>
        <CardMeta>{t("pages.assetDetail.sections.timelineMeta", { count })}</CardMeta>
      </CardHeader>
      <div className="px-5 py-3">
        {count === 0 ? (
          <div className="text-muted-foreground text-[12.5px]">
            {t("pages.assetDetail.empty.noTransitions")}
          </div>
        ) : (
          transitions.map((transition, idx) => {
            const kind: TimelineKind = classifyTransition(transition.toState);
            const label: string =
              transition.fromState !== undefined
                ? `${transition.fromState} → ${transition.toState}`
                : transition.toState;
            const actor: string = transition.occurredBy ?? "system";
            return (
              <div
                key={`${transition.occurredAt}-${transition.toState}-${String(idx)}`}
                className="grid grid-cols-[18px_1fr] gap-3 py-2"
              >
                <div className="relative">
                  <div
                    className={cn(
                      "mt-1 size-[10px] rounded-full border-2",
                      KIND_SOLID.includes(kind)
                        ? cn("border-current", KIND_COLOR[kind])
                        : cn("bg-background border-current", KIND_COLOR[kind]),
                    )}
                  />
                  {idx < transitions.length - 1 && (
                    <div className="bg-border absolute top-[18px] bottom-[-8px] left-[4px] w-px" />
                  )}
                </div>
                <div>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-mono text-[12.5px] font-medium">{label}</span>
                    <span className="text-latam-indigo font-mono text-[11px]">{actor}</span>
                    <span className="text-muted-foreground ml-auto font-mono text-[11px]">
                      {transition.occurredAt.replace("T", " ")}
                    </span>
                  </div>
                  {transition.reason !== undefined && transition.reason !== "" && (
                    <div className="text-muted-foreground text-[12px] leading-relaxed">
                      {transition.reason}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {processingJob !== undefined && (
          <div className="border-border mt-3 border-t pt-3 text-[11.5px]">
            <div className="text-muted-foreground tracking-wider uppercase">
              {t("pages.assetDetail.timeline.processingJob")}
            </div>
            <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11.5px] md:grid-cols-4">
              <div>
                <span className="text-muted-foreground">
                  {t("pages.assetDetail.timeline.state")}:{" "}
                </span>
                {processingJob.state}
              </div>
              <div>
                <span className="text-muted-foreground">
                  {t("pages.assetDetail.timeline.attempt")}:{" "}
                </span>
                {String(processingJob.attemptNumber)}
              </div>
              {processingJob.currentStep !== undefined && (
                <div>
                  <span className="text-muted-foreground">
                    {t("pages.assetDetail.timeline.step")}:{" "}
                  </span>
                  {processingJob.currentStep}
                </div>
              )}
              {processingJob.workerId !== undefined && (
                <div>
                  <span className="text-muted-foreground">
                    {t("pages.assetDetail.timeline.worker")}:{" "}
                  </span>
                  {processingJob.workerId}
                </div>
              )}
            </div>
            {processingJob.lastError !== undefined && (
              <div className="text-danger mt-1.5 text-[11.5px]">{processingJob.lastError}</div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
