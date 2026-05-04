import type { StorageBindingResponseDTO } from "@shared/backend-api";
import React, { useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/common/Button";
import { useDeleteStorageBinding } from "@/features/system/hooks/useSystem";
import { logger } from "@/lib/logger";

interface IDeleteStorageBindingDialogProps {
  open: boolean;
  binding?: StorageBindingResponseDTO;
  onClose: () => void;
}

export function DeleteStorageBindingDialog({
  open,
  binding,
  onClose,
}: IDeleteStorageBindingDialogProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const titleId = useId();
  const bodyId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  const deleteMutation = useDeleteStorageBinding();

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

  if (!open || !binding) return null;

  async function onConfirm(): Promise<void> {
    if (!binding) return;
    try {
      await deleteMutation.mutateAsync(binding.name);
      onClose();
    } catch (err) {
      logger.error("Failed to delete storage binding", err instanceof Error ? err : undefined, {
        bindingName: binding.name,
      });
    }
  }

  const isPending = deleteMutation.isPending;

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- Escape closes via document listener; backdrop click is supplemental
    <div
      className="bg-foreground/30 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
      onClick={onClose}
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
            {t("pages.system.storageBindings.deleteConfirm.title", { name: binding.name })}
          </h2>
          <p id={bodyId} className="text-muted-foreground mt-2 text-sm">
            {t("pages.system.storageBindings.deleteConfirm.body")}
          </p>
        </div>
        <div className="border-border bg-card flex items-center justify-end gap-2 border-t px-5 py-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            {t("pages.system.storageBindings.deleteConfirm.cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              void onConfirm();
            }}
            disabled={isPending}
          >
            {t("pages.system.storageBindings.deleteConfirm.confirm")}
          </Button>
        </div>
      </div>
    </div>
  );
}
