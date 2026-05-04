import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

// Icon sizes for nav chevrons
const NAV_CHEVRON_SIZE = 13;
const EDGE_CHEVRON_SIZE = 13;

// Threshold: show "Go to page" form only when there are more than this many pages
const GO_TO_THRESHOLD = 7;

interface IPaginatorProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

function buildSequence(page: number, totalPages: number): Array<number | string> {
  const last = totalPages - 1;
  const span = 1; // pages each side of current
  const set = new Set<number>([0, last, page]);
  for (let i = 1; i <= span; i++) {
    if (page - i >= 0) set.add(page - i);
    if (page + i <= last) set.add(page + i);
  }
  // Keep edges together: include page 1 and page last-1 so 1,2 and last-1,last never gap
  if (last >= 1) set.add(1);
  if (last >= 2) set.add(last - 1);

  const sorted = [...set].filter((num) => num >= 0 && num <= last).sort((a, b) => a - b);
  const out: Array<number | string> = [];
  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    if (current === undefined) continue;
    out.push(current);
    const next = sorted[i + 1];
    if (next !== undefined && next !== null && next > current + 1) {
      out.push("ellipsis_" + String(i));
    }
  }
  return out;
}

export function Paginator({
  page,
  totalPages,
  onChange,
}: IPaginatorProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const [jumpVal, setJumpVal] = useState("");

  if (totalPages <= 1) return null;

  function go(targetPage: number): void {
    if (targetPage < 0 || targetPage > totalPages - 1) return;
    onChange(targetPage);
  }

  function onJump(ev: React.SyntheticEvent<HTMLFormElement>): void {
    ev.preventDefault();
    const parsed = parseInt(jumpVal, 10);
    if (!Number.isFinite(parsed)) return;
    go(Math.min(Math.max(parsed - 1, 0), totalPages - 1));
    setJumpVal("");
  }

  const seq = buildSequence(page, totalPages);

  const navBtnCls = cn(
    "grid size-8 place-items-center rounded border border-border bg-card text-muted-foreground transition-colors",
    "hover:border-latam-indigo/30 hover:bg-secondary hover:text-latam-indigo",
    "disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-border disabled:hover:bg-card disabled:hover:text-muted-foreground",
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      <nav className="inline-flex items-center gap-1" aria-label={t("paginator.label")}>
        <button
          type="button"
          aria-label={t("paginator.firstPage")}
          title={t("paginator.firstPage")}
          disabled={page === 0}
          onClick={() => {
            go(0);
          }}
          className={navBtnCls}
        >
          <ChevronFirst size={EDGE_CHEVRON_SIZE} />
        </button>

        <button
          type="button"
          aria-label={t("paginator.previousPage")}
          title={t("paginator.previousPage")}
          disabled={page === 0}
          onClick={() => {
            go(page - 1);
          }}
          className={navBtnCls}
        >
          <ChevronLeft size={NAV_CHEVRON_SIZE} />
        </button>

        <div className="mx-1 inline-flex items-center gap-0.5">
          {seq.map((pageNum) => {
            if (typeof pageNum === "string") {
              return (
                <span
                  key={pageNum}
                  className="text-muted-foreground/50 grid size-8 place-items-center font-mono text-[12px]"
                >
                  …
                </span>
              );
            }
            const active = pageNum === page;
            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => {
                  go(pageNum);
                }}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "min-w-[32px] rounded border px-2 py-1.5 font-mono text-[12px] tabular-nums transition-colors",
                  active
                    ? "border-latam-indigo bg-latam-indigo text-white"
                    : "border-border bg-card text-muted-foreground hover:border-latam-indigo/30 hover:bg-secondary hover:text-latam-indigo",
                )}
              >
                {(pageNum + 1).toLocaleString()}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          aria-label={t("paginator.nextPage")}
          title={t("paginator.nextPage")}
          disabled={page >= totalPages - 1}
          onClick={() => {
            go(page + 1);
          }}
          className={navBtnCls}
        >
          <ChevronRight size={NAV_CHEVRON_SIZE} />
        </button>

        <button
          type="button"
          aria-label={t("paginator.lastPage")}
          title={t("paginator.lastPage")}
          disabled={page >= totalPages - 1}
          onClick={() => {
            go(totalPages - 1);
          }}
          className={navBtnCls}
        >
          <ChevronLast size={EDGE_CHEVRON_SIZE} />
        </button>
      </nav>

      {totalPages > GO_TO_THRESHOLD && (
        <form
          onSubmit={onJump}
          className="text-muted-foreground hidden items-center gap-1.5 text-[11.5px] md:inline-flex"
        >
          <span>{t("paginator.goTo")}</span>
          <input
            type="text"
            inputMode="numeric"
            value={jumpVal}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setJumpVal(e.target.value.replace(/[^0-9]/g, ""));
            }}
            placeholder={String(page + 1)}
            aria-label={t("paginator.jumpToPage")}
            className="border-input bg-card text-foreground placeholder:text-muted-foreground/60 focus:border-latam-indigo focus:ring-latam-indigo/20 h-7 w-16 rounded border px-2 text-center font-mono text-[12px] focus:ring-1 focus:outline-none"
          />
        </form>
      )}
    </div>
  );
}
