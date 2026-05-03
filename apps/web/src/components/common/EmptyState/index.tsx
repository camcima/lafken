import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface IEmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: IEmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn("flex flex-col items-center justify-center gap-3 py-12 text-center", className)}
    >
      {Icon && (
        <div className="flex size-12 items-center justify-center rounded-full bg-neutral-100">
          <Icon className="size-6 text-neutral-500" aria-hidden />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-neutral-900">{title}</p>
        {description && <p className="max-w-sm text-sm text-neutral-500">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
