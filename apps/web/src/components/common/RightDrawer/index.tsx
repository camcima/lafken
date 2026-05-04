import { X } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

interface IRightDrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Optional secondary line above the title (eyebrow caption). */
  caption?: ReactNode;
  /** Buttons rendered next to the title (left of close). */
  headerExtras?: ReactNode;
  /** Sticky bottom bar — e.g. action buttons. */
  footer?: ReactNode;
  /** max-width class for the panel; default `max-w-[480px]`. */
  maxWidthClass?: string;
  children: ReactNode;
}

export function RightDrawer({
  open,
  onClose,
  title,
  caption,
  headerExtras,
  footer,
  children,
  maxWidthClass = "max-w-[480px]",
}: IRightDrawerProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- backdrop dismiss is supplemental; Escape key handled in dialog
    <div
      className="bg-foreground/30 fixed inset-0 z-40 flex justify-end backdrop-blur-sm"
      onClick={onClose}
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events -- dialog role is interactive; Escape key handled by document listener; stopPropagation prevents backdrop dismiss */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
        }}
        className={cn("bg-card flex h-full w-full flex-col shadow-2xl outline-none", maxWidthClass)}
      >
        <div className="border-border bg-card sticky top-0 flex items-start justify-between border-b px-5 py-3">
          <div>
            {caption ? (
              <div className="text-muted-foreground text-[10.5px] tracking-wider uppercase">
                {caption}
              </div>
            ) : null}
            <div id={titleId} className="font-mono text-[14px] font-semibold">
              {title}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {headerExtras}
            <button
              type="button"
              onClick={onClose}
              aria-label={t("common.actions.close")}
              className="text-muted-foreground hover:text-foreground rounded p-1"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer ? (
          <div className="border-border bg-card sticky bottom-0 flex items-center justify-end gap-2 border-t px-5 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
