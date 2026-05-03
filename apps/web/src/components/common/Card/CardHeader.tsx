import { type ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "border-border/60 flex flex-row items-center gap-3 border-b px-5 py-3",
        className,
      )}
      {...props}
    />
  );
}
