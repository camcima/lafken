import React, { useCallback, useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/common/Button";

interface IDeleteAssetDialogProps {
  open: boolean;
  publicId: string;
  isPending: boolean;
  errorMessage?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export function DeleteAssetDialog({
  open,
  publicId,
  isPending,
  errorMessage,
  onConfirm,
  onClose,
}: IDeleteAssetDialogProps): React.JSX.Element | null {
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
            {t("pages.assetDetail.delete.confirmTitle", { publicId })}
          </h2>
          <p id={bodyId} className="text-muted-foreground mt-2 text-sm">
            {t("pages.assetDetail.delete.confirmBody")}
          </p>
          {errorMessage ? (
            <div
              role="alert"
              className="border-destructive/40 bg-destructive/10 text-destructive mt-3 rounded-md border px-3 py-2 text-sm"
            >
              {errorMessage}
            </div>
          ) : null}
        </div>
        <div className="border-border bg-card flex items-center justify-end gap-2 border-t px-5 py-3">
          <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
            {t("pages.assetDetail.delete.cancel")}
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={isPending}>
            {t("pages.assetDetail.delete.confirm")}
          </Button>
        </div>
      </div>
    </div>
  );
}
