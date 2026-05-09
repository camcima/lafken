import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/common/Button";
import { useLiftLegalHold } from "@/features/legal-holds/hooks/useLegalHoldMutations";

// ── Constants ────────────────────────────────────────────────────────────────

const REASON_MIN_LEN = 10;
const REASON_MAX_LEN = 1_000;
const TEXTAREA_DEFAULT_ROWS = 4;

// ── Local helpers ────────────────────────────────────────────────────────────

interface ITextAreaProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
}

function TextArea({
  id,
  value,
  onChange,
  placeholder,
  maxLength,
  rows = TEXTAREA_DEFAULT_ROWS,
}: ITextAreaProps): React.JSX.Element {
  return (
    <textarea
      id={id}
      value={value}
      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onChange(e.target.value);
      }}
      placeholder={placeholder}
      maxLength={maxLength}
      rows={rows}
      className="border-input bg-card focus:ring-ring mt-1 w-full resize-y rounded-md border px-3 py-2 text-[12.5px] leading-relaxed outline-none focus:ring-1"
    />
  );
}

// ── Props ────────────────────────────────────────────────────────────────────

interface ILiftLegalHoldDialogProps {
  open: boolean;
  holdId: string;
  caseReference: string;
  onClose: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function LiftLegalHoldDialog({
  open,
  holdId,
  caseReference,
  onClose,
}: ILiftLegalHoldDialogProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const titleId = useId();
  const bodyId = useId();
  const textareaId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [liftReason, setLiftReason] = useState("");

  const liftMutation = useLiftLegalHold();

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  const handleClose = useCallback((): void => {
    setLiftReason("");
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

  if (!open) return null;

  const isValid = liftReason.length >= REASON_MIN_LEN;
  const isSubmitDisabled = !isValid || liftMutation.isPending;

  function handleSubmit(): void {
    liftMutation.mutate(
      { id: holdId, liftReason },
      {
        onSuccess: () => {
          toast.success(t("pages.legalHolds.lift.toast.success", { caseReference }));
          handleClose();
        },
        onError: (err: Error) => {
          toast.error(t("pages.legalHolds.lift.toast.failure", { error: err.message }));
        },
      },
    );
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
            {t("pages.legalHolds.lift.title")}
          </h2>
          <p id={bodyId} className="text-muted-foreground mt-2 text-sm">
            {t("pages.legalHolds.lift.warning")}
          </p>
          <div className="mt-3">
            <label htmlFor={textareaId} className="text-foreground text-[12.5px] font-medium">
              {t("pages.legalHolds.lift.reasonLabel")}
            </label>
            <TextArea
              id={textareaId}
              value={liftReason}
              onChange={setLiftReason}
              placeholder={t("pages.legalHolds.lift.reasonPlaceholder")}
              maxLength={REASON_MAX_LEN}
            />
            <div className="text-muted-foreground mt-1 text-right text-[11px]">
              {t("pages.legalHolds.lift.reasonCounter", { count: liftReason.length })}
            </div>
          </div>
        </div>
        <div className="border-border bg-card flex items-center justify-end gap-2 border-t px-5 py-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={liftMutation.isPending}
          >
            {t("pages.legalHolds.lift.cancel")}
          </Button>
          <Button type="button" variant="danger" onClick={handleSubmit} disabled={isSubmitDisabled}>
            {t("pages.legalHolds.lift.submit")}
          </Button>
        </div>
      </div>
    </div>
  );
}
