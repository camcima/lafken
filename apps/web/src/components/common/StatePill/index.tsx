import { cva, type VariantProps } from "class-variance-authority";
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

const statePillVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      state: {
        pending: "bg-secondary text-muted-foreground",
        uploaded: "bg-info-soft text-info",
        processing: "bg-info-soft text-info",
        ready: "bg-ok-soft text-ok",
        rejected: "bg-warn-soft text-warn",
        quarantined_virus: "bg-alert-soft text-alert",
        quarantined_moderation: "bg-alert-soft text-alert",
        processing_failed: "bg-danger-soft text-danger",
        expired: "bg-secondary text-muted-foreground",
        deleted: "bg-secondary text-muted-foreground",
      },
    },
    defaultVariants: {
      state: "pending",
    },
  },
);

interface IStatePillProps extends VariantProps<typeof statePillVariants> {
  state: AssetState;
  className?: string;
}

export function StatePill({ state, className }: IStatePillProps) {
  const { t } = useTranslation();

  return (
    <span
      data-slot="state-pill"
      data-state={state}
      className={cn(statePillVariants({ state, className }))}
    >
      {t(`assetStates.${state}`)}
    </span>
  );
}
