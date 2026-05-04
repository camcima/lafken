import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

export type AssetState =
  | "pending"
  | "uploaded"
  | "processing"
  | "ready"
  | "rejected"
  | "quarantined_virus"
  | "quarantined_moderation"
  | "processing_failed"
  | "expired"
  | "deleted";

const STATE_COLORS: Record<AssetState, string> = {
  pending: "#94a3b8",
  uploaded: "#94a3b8",
  processing: "#0e7ea8",
  ready: "#1f7a4f",
  rejected: "#a16207",
  quarantined_virus: "#8A4209",
  quarantined_moderation: "#8A4209",
  processing_failed: "#8B271A",
  expired: "#cbd5e1",
  deleted: "#cbd5e1",
};

const STATE_TEXT_CLASSES: Record<AssetState, string> = {
  pending: "bg-secondary text-muted-foreground border-border",
  uploaded: "bg-info-soft text-info border-info-line",
  processing: "bg-info-soft text-info border-info-line",
  ready: "bg-ok-soft text-ok border-ok-line",
  rejected: "bg-warn-soft text-warn border-warn-line",
  quarantined_virus: "bg-alert-soft text-alert border-alert-line",
  quarantined_moderation: "bg-alert-soft text-alert border-alert-line",
  processing_failed: "bg-danger-soft text-danger border-danger-line",
  expired: "bg-secondary text-muted-foreground border-border",
  deleted: "bg-secondary text-muted-foreground border-border",
};

interface IStatePillProps {
  state: AssetState;
  className?: string;
  lg?: boolean;
}

export function StatePill({ state, className, lg }: IStatePillProps) {
  const { t } = useTranslation();
  const dotColor = STATE_COLORS[state];
  const textClass = STATE_TEXT_CLASSES[state];

  return (
    <span
      data-slot="state-pill"
      data-state={state}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium tabular-nums",
        lg ? "px-2.5 py-1 text-[12.5px]" : "px-2 py-0.5 text-[11.5px]",
        textClass,
        className,
      )}
    >
      <span
        className="size-1.5 flex-none rounded-full"
        style={{ background: dotColor }}
        aria-hidden="true"
      />
      {t(`assetStates.${state}`)}
    </span>
  );
}
