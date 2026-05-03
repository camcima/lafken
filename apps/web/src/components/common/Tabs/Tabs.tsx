import { cn } from "@/lib/utils";

export interface ITab<TId extends string = string> {
  id: TId;
  label: string;
  count?: number;
}

interface ITabsProps<TId extends string = string> {
  value: TId;
  onValueChange: (id: TId) => void;
  items: ITab<TId>[];
  className?: string;
}

export function Tabs<TId extends string>({
  value,
  onValueChange,
  items,
  className,
}: ITabsProps<TId>) {
  return (
    <div className={cn("border-border -mt-1 mb-5 flex border-b", className)} role="tablist">
      {items.map((tab) => {
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => {
              onValueChange(tab.id);
            }}
            className={cn(
              "-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2 text-[12.5px] transition-colors",
              active
                ? "border-latam-pink text-latam-indigo-deep font-medium"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {tab.label}
            {tab.count !== null && tab.count !== undefined && (
              <span className="bg-secondary text-muted-foreground rounded-full px-1.5 py-px font-mono text-[10.5px]">
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
