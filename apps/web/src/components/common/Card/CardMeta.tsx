import { type ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function CardMeta({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "text-muted-foreground ml-auto inline-flex items-center gap-2 text-[12px]",
        className,
      )}
      {...props}
    />
  );
}
