import { type ComponentProps, type Ref } from "react";

import { cn } from "@/lib/utils";

interface ICardProps extends ComponentProps<"div"> {
  ref?: Ref<HTMLDivElement>;
}

export function Card({ ref, className, ...props }: ICardProps) {
  return (
    <div
      ref={ref}
      className={cn(
        "border-border bg-card text-card-foreground rounded-md border shadow-sm",
        className,
      )}
      {...props}
    />
  );
}
