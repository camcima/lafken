import { AssetImage } from "@lafken/react";
import type { AssetResponseDTO } from "@shared/backend-api";

import { fmtBytes } from "@/lib/utils";

interface IVisualBlockProps {
  asset: AssetResponseDTO;
}

export function VisualBlock({ asset }: IVisualBlockProps): React.JSX.Element {
  const previewable: boolean =
    asset.state === "uploaded" || asset.state === "processing" || asset.state === "ready";
  const dimsLabel: string =
    asset.width !== undefined && asset.height !== undefined
      ? `${String(asset.width)} × ${String(asset.height)}`
      : "—";
  const sizeLabel: string = asset.sizeBytes !== undefined ? fmtBytes(asset.sizeBytes) : "—";
  const mimeLabel: string = asset.mimeType ?? "—";

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

        {/* Top overlay — dimensions / mime / size */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-3 bg-gradient-to-b from-black/45 to-transparent px-3.5 py-2.5 font-mono text-[11.5px] text-white/85">
          <span className="relative size-3.5 rounded-full border border-white/60">
            <span className="absolute -top-0.5 -bottom-0.5 left-1/2 w-px -translate-x-1/2 bg-white/60" />
            <span className="absolute top-1/2 -right-0.5 -left-0.5 h-px -translate-y-1/2 bg-white/60" />
          </span>
          <span>{dimsLabel}</span>
          <span className="opacity-50">·</span>
          <span>{mimeLabel}</span>
          <span className="opacity-50">·</span>
          <span>{sizeLabel}</span>
        </div>
      </div>
    </div>
  );
}
