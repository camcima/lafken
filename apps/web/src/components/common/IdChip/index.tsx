import { Check, Copy } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useCopy } from "@/hooks/useCopy";
import { cn } from "@/lib/utils";

const ID_DISPLAY_LENGTH = 8;

interface IIdChipProps {
  id: string;
  className?: string;
  variant?: "default" | "indigo";
}

export function IdChip({ id, className, variant = "default" }: IIdChipProps): React.JSX.Element {
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
        "inline-flex cursor-pointer items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-xs transition-colors",
        variant === "indigo" && !isCopied
          ? "text-latam-indigo-deep border-[#C9C2EC] bg-[#ECE9FA] hover:bg-[#DDD5F5]"
          : variant === "indigo" && isCopied
            ? "border-ok-line bg-ok-soft text-ok"
            : !isCopied
              ? "border-neutral-200 bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              : "border-ok-line bg-ok-soft text-ok",
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
