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

  // Photoshop-style transparency checker. Two offset diagonal gradients drawn
  // with translucent gray, so the underlying `bg-card` colour controls the
  // brightness in light vs dark mode and the checker stays visible against
  // either. 20px squares are visible without dominating the small heroes used
  // for icon-sized previews.
  const checkerStyle: React.CSSProperties = {
    backgroundImage:
      "linear-gradient(45deg, rgba(128,128,128,0.18) 25%, transparent 25%, transparent 75%, rgba(128,128,128,0.18) 75%, rgba(128,128,128,0.18))," +
      "linear-gradient(45deg, rgba(128,128,128,0.18) 25%, transparent 25%, transparent 75%, rgba(128,128,128,0.18) 75%, rgba(128,128,128,0.18))",
    backgroundSize: "20px 20px",
    backgroundPosition: "0 0, 10px 10px",
  };

  return (
    <div className="border-border bg-card overflow-hidden rounded-md border">
      <div
        className="bg-card relative grid aspect-[4/3] place-items-center overflow-hidden"
        style={checkerStyle}
      >
        {previewable && (
          <AssetImage
            publicId={asset.publicId}
            preset="lafken:detail-hero"
            alt=""
            className="border-border block max-h-full max-w-full border"
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
