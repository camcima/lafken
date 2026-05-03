import { type ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-5", className)} {...props} />;
}
