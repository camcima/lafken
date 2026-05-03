import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface IDLRowProps {
  label: string;
  children: ReactNode;
  last?: boolean;
}

export function DLRow({ label, children, last = false }: IDLRowProps): React.JSX.Element {
  return (
    <div
      className={cn(
        "flex items-start gap-3 py-1.5 text-[12.5px]",
        !last && "border-border/60 border-b border-dashed",
      )}
    >
      <div className="text-muted-foreground w-32 flex-none text-[12px]">{label}</div>
      <div className="min-w-0 flex-1 overflow-hidden break-words">{children}</div>
    </div>
  );
}
