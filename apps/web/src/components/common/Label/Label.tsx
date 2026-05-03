import { type ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    // eslint-disable-next-line jsx-a11y/label-has-associated-control -- htmlFor/nesting is the caller's responsibility
    <label
      className={cn(
        "text-muted-foreground text-[10.5px] font-medium tracking-wider uppercase",
        className,
      )}
      {...props}
    />
  );
}
