import { AssetImage } from "@lafken/react";
import type { AssetResponseDTO } from "@shared/backend-api";
import { Download, Eye } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/common/Button";
import { fmtBytes } from "@/lib/utils";

interface IVisualBlockProps {
  asset: AssetResponseDTO;
}

const PUBLIC_ID_PREFIX_LEN = 10;

export function VisualBlock({ asset }: IVisualBlockProps): React.JSX.Element {
  const { t } = useTranslation();
  const previewable: boolean =
    asset.state === "uploaded" || asset.state === "processing" || asset.state === "ready";
  const dimsLabel: string =
    asset.width !== undefined && asset.height !== undefined
      ? `${String(asset.width)} × ${String(asset.height)}`
      : "—";
  const sizeLabel: string = asset.sizeBytes !== undefined ? fmtBytes(asset.sizeBytes) : "—";
  const mimeLabel: string = asset.mimeType ?? "—";
  const shortId: string = asset.publicId.slice(0, PUBLIC_ID_PREFIX_LEN);

  return (
    <div className="border-border bg-card overflow-hidden rounded-md border">
      <div
        className="relative aspect-[4/3] overflow-hidden"
        style={{ background: "linear-gradient(to bottom, #1F1A3D, #0F0A2E)" }}
      >
        {previewable && (
          <AssetImage
            publicId={asset.publicId}
            preset="lafken:detail-hero"
            alt=""
            className="absolute inset-0 h-full w-full object-contain"
          />
        )}

        {/* Top overlay */}
        <div className="pointer-events-none absolute inset-0 flex flex-col">
          <div className="flex items-center gap-3 bg-gradient-to-b from-black/45 to-transparent px-3.5 py-2.5 font-mono text-[11.5px] text-white/85">
            <span className="relative size-3.5 rounded-full border border-white/60">
              <span className="absolute -top-0.5 -bottom-0.5 left-1/2 w-px -translate-x-1/2 bg-white/60" />
              <span className="absolute top-1/2 -right-0.5 -left-0.5 h-px -translate-y-1/2 bg-white/60" />
            </span>
            <span>{dimsLabel}</span>
            <span className="opacity-50">·</span>
            <span>{mimeLabel}</span>
            <span className="opacity-50">·</span>
            <span>{sizeLabel}</span>
            <span className="flex-1" />
            <span>preset: lafken:detail-hero</span>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-3 bg-gradient-to-t from-black/50 to-transparent px-3.5 py-2.5 font-mono text-[11.5px] text-white/85">
            <span>{asset.namespaceSlug}</span>
            <span className="opacity-50">/</span>
            <span>{shortId}…</span>
            <span className="flex-1" />
            <span>policy v{asset.policyVersion}</span>
          </div>
        </div>

        {/* Glass action buttons */}
        <div className="absolute right-3 bottom-3 flex gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 border border-white/20 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
          >
            <Eye size={13} />
            {t("pages.assetDetail.visual.fullSize")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 border border-white/20 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
          >
            <Download size={13} />
            {t("pages.assetDetail.visual.original")}
          </Button>
        </div>
      </div>
    </div>
  );
}
