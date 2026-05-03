import { type ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function CardTitle({ className, ...props }: ComponentProps<"h3">) {
  // eslint-disable-next-line jsx-a11y/heading-has-content -- content is passed via ...props by the caller
  return <h3 className={cn("text-[13px] font-semibold tracking-tight", className)} {...props} />;
}
