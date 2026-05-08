import React, { useCallback, useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/common/Button";

interface IDeactivatePresetDialogProps {
  open: boolean;
  presetName: string;
  isPending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function DeactivatePresetDialog({
  open,
  presetName,
  isPending,
  onConfirm,
  onClose,
}: IDeactivatePresetDialogProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const titleId = useId();
  const bodyId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  const handleClose = useCallback((): void => {
    if (isPending) return;
    onClose();
  }, [isPending, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [open, handleClose]);

  if (!open) return null;

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- Escape closes via document listener; backdrop click is supplemental
    <div
      className="bg-foreground/30 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
      onClick={handleClose}
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events -- dialog role; stopPropagation prevents backdrop dismiss */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
        }}
        className="bg-card w-full max-w-md rounded-lg shadow-2xl outline-none"
      >
        <div className="px-5 py-4">
          <h2 id={titleId} className="text-foreground text-base font-semibold">
            {t("pages.namespaces.presets.deactivate.confirmTitle", { name: presetName })}
          </h2>
          <p id={bodyId} className="text-muted-foreground mt-2 text-sm">
            {t("pages.namespaces.presets.deactivate.confirmBody")}
          </p>
        </div>
        <div className="border-border bg-card flex items-center justify-end gap-2 border-t px-5 py-3">
          <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
            {t("pages.namespaces.presets.deactivate.cancel")}
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={isPending}>
            {t("pages.namespaces.presets.deactivate.confirm")}
          </Button>
        </div>
      </div>
    </div>
  );
}
