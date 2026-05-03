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
        pending: "bg-neutral-100 text-neutral-700",
        uploaded: "bg-petroleum-50 text-petroleum-600",
        processing: "bg-petroleum-50 text-petroleum-600",
        ready: "bg-teal-50 text-teal-700",
        rejected: "bg-coral-50 text-coral-700",
        quarantined_virus: "bg-coral-50 text-coral-700",
        quarantined_moderation: "bg-orange-50 text-orange-700",
        processing_failed: "bg-coral-50 text-coral-700",
        expired: "bg-neutral-100 text-neutral-500",
        deleted: "bg-neutral-100 text-neutral-500",
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
