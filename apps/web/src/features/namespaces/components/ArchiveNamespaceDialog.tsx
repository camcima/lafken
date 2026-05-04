import type { NamespaceResponseDTO } from "@shared/backend-api";
import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/common/Button";
import {
  useArchiveNamespace,
  useUnarchiveNamespace,
} from "@/features/namespaces/hooks/useNamespaces";
import { ApiError } from "@/lib/api/api-error";
import { logger } from "@/lib/logger";

interface IArchiveNamespaceDialogProps {
  open: boolean;
  mode: "archive" | "unarchive";
  namespace?: NamespaceResponseDTO;
  onClose: () => void;
}

export function ArchiveNamespaceDialog({
  open,
  mode,
  namespace,
  onClose,
}: IArchiveNamespaceDialogProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const titleId = useId();
  const bodyId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const archiveMutation = useArchiveNamespace();
  const unarchiveMutation = useUnarchiveNamespace();

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  const handleClose = useCallback((): void => {
    setErrorMessage(null);
    onClose();
  }, [onClose]);

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

  if (!open || !namespace) return null;

  const isPending = archiveMutation.isPending || unarchiveMutation.isPending;

  const title =
    mode === "archive"
      ? t("pages.namespaces.archive.confirmArchiveTitle", { name: namespace.displayName })
      : t("pages.namespaces.archive.confirmUnarchiveTitle", { name: namespace.displayName });

  const body =
    mode === "archive"
      ? t("pages.namespaces.archive.confirmArchiveBody")
      : t("pages.namespaces.archive.confirmUnarchiveBody");

  async function onConfirm(): Promise<void> {
    if (!namespace) return;
    setErrorMessage(null);
    try {
      if (mode === "archive") {
        await archiveMutation.mutateAsync(namespace.slug);
      } else {
        await unarchiveMutation.mutateAsync(namespace.slug);
      }
      handleClose();
    } catch (err) {
      logger.error(`Failed to ${mode} namespace`, err instanceof Error ? err : undefined, {
        slug: namespace.slug,
      });
      const detail = err instanceof ApiError ? err.body.detail : undefined;
      setErrorMessage(detail ?? t("pages.namespaces.errors.generic"));
    }
  }

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
            {title}
          </h2>
          <p id={bodyId} className="text-muted-foreground mt-2 text-sm">
            {body}
          </p>
          {errorMessage ? (
            <div
              id="archive-namespace-dialog-error"
              role="alert"
              className="border-destructive/40 bg-destructive/10 text-destructive mt-3 rounded-md border px-3 py-2 text-sm"
            >
              {errorMessage}
            </div>
          ) : null}
        </div>
        <div className="border-border bg-card flex items-center justify-end gap-2 border-t px-5 py-3">
          <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
            {t("pages.namespaces.archive.cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              void onConfirm();
            }}
            disabled={isPending}
          >
            {t("pages.namespaces.archive.confirm")}
          </Button>
        </div>
      </div>
    </div>
  );
}
