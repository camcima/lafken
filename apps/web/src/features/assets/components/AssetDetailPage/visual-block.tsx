import { Download, Eye } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/common/Button";
import type { IDemoAssetDetail } from "@/lib/demo/lafken-demo-data";
import { cn, fmtBytes } from "@/lib/utils";

interface IVisualBlockProps {
  asset: IDemoAssetDetail;
}

export function VisualBlock({ asset }: IVisualBlockProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="border-border bg-card overflow-hidden rounded-md border">
      <div
        className="relative aspect-[4/3] overflow-hidden"
        style={{ background: "linear-gradient(to bottom, #1F1A3D, #0F0A2E)" }}
      >
        {/* Top overlay */}
        <div className="pointer-events-none absolute inset-0 flex flex-col">
          <div className="flex items-center gap-3 bg-gradient-to-b from-black/45 to-transparent px-3.5 py-2.5 font-mono text-[11.5px] text-white/85">
            <span className="relative size-3.5 rounded-full border border-white/60">
              <span className="absolute -top-0.5 -bottom-0.5 left-1/2 w-px -translate-x-1/2 bg-white/60" />
              <span className="absolute top-1/2 -right-0.5 -left-0.5 h-px -translate-y-1/2 bg-white/60" />
            </span>
            <span>
              {asset.dimensions.width} × {asset.dimensions.height}
            </span>
            <span className="opacity-50">·</span>
            <span>JPEG</span>
            <span className="opacity-50">·</span>
            <span>{fmtBytes(asset.fileSize)}</span>
            <span className="flex-1" />
            <span>preset: detail_main</span>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-3 bg-gradient-to-t from-black/50 to-transparent px-3.5 py-2.5 font-mono text-[11.5px] text-white/85">
            <span>{asset.namespace.slug}</span>
            <span className="opacity-50">/</span>
            <span>{asset.shortId}…</span>
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

      {/* Sibling strip */}
      <div className="border-border bg-secondary/50 flex gap-1.5 overflow-x-auto border-t px-3 py-2.5">
        {asset.siblingAssets.map((sibling) => (
          <div
            key={sibling.id}
            className={cn(
              "border-border relative h-[42px] w-14 flex-none cursor-pointer overflow-hidden rounded border",
              sibling.id === asset.shortId &&
                "outline-latam-pink outline outline-2 outline-offset-1",
            )}
            style={{
              background: `hsl(${String(sibling.thumbHue)}, 45%, 28%)`,
            }}
          >
            <span className="absolute bottom-0.5 left-1 rounded-sm bg-black/40 px-1 font-mono text-[9.5px] text-white">
              {sibling.label}
            </span>
            {sibling.state === "processing" && (
              <span className="bg-info/20 absolute inset-0 animate-pulse" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
