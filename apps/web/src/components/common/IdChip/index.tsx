import { Check, Copy } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useCopy } from "@/hooks/useCopy";
import { cn } from "@/lib/utils";

const ID_DISPLAY_LENGTH = 8;

interface IIdChipProps {
  id: string;
  className?: string;
}

export function IdChip({ id, className }: IIdChipProps) {
  const { t } = useTranslation();
  const { copied, copy } = useCopy();

  const isCopied = copied === id;
  const displayId = id.length > ID_DISPLAY_LENGTH ? `${id.slice(0, ID_DISPLAY_LENGTH)}…` : id;

  return (
    <button
      type="button"
      data-slot="id-chip"
      title={isCopied ? t("idChip.copied") : t("idChip.copyToClipboard")}
      aria-label={isCopied ? t("idChip.copied") : t("idChip.copyToClipboard")}
      onClick={() => void copy(id)}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1 rounded border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 font-mono text-xs text-neutral-600 transition-colors hover:bg-neutral-200",
        className,
      )}
    >
      <span>{displayId}</span>
      {isCopied ? (
        <Check className="text-ok size-3" aria-hidden />
      ) : (
        <Copy className="size-3" aria-hidden />
      )}
    </button>
  );
}
