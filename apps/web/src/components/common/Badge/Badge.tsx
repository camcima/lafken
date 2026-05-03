import { cva, type VariantProps } from "class-variance-authority";
import { type ComponentProps } from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11.5px] font-medium whitespace-nowrap tabular-nums",
  {
    variants: {
      variant: {
        default: "border-border bg-secondary text-secondary-foreground",
        indigo: "border-latam-indigo bg-latam-indigo text-white",
        pink: "border-latam-pink bg-latam-pink text-white",
        "indigo-soft": "border-[#C9C2EC] bg-[#ECE9FA] text-latam-indigo-deep",
        ok: "border-ok-line bg-ok-soft text-ok",
        info: "border-info-line bg-info-soft text-info",
        warn: "border-warn-line bg-warn-soft text-warn",
        alert: "border-alert-line bg-alert-soft text-alert",
        danger: "border-danger-line bg-danger-soft text-danger",
        muted: "border-border bg-secondary text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

interface IBadgeProps extends ComponentProps<"span">, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: IBadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}
