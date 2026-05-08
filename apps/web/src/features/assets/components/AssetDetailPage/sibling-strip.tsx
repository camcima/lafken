import { AssetImage } from "@lafken/react";
import type { AssetResponseDTO } from "@shared/backend-api";
import { Link } from "@tanstack/react-router";

import { cn } from "@/lib/utils";

interface ISiblingStripProps {
  siblings: AssetResponseDTO[];
}

const PUBLIC_ID_LABEL_LEN = 6;

export function SiblingStrip({ siblings }: ISiblingStripProps): React.JSX.Element | null {
  if (siblings.length === 0) {
    return null;
  }

  return (
    <div className="border-border bg-card overflow-hidden rounded-md border">
      <div className="bg-secondary/50 flex gap-1.5 overflow-x-auto px-3 py-2.5">
        {siblings.map((sibling) => {
          const previewable: boolean =
            sibling.state === "uploaded" ||
            sibling.state === "processing" ||
            sibling.state === "ready";
          const label: string = sibling.publicId.slice(0, PUBLIC_ID_LABEL_LEN);
          return (
            <Link
              key={sibling.id}
              to="/assets/$id"
              params={{ id: sibling.id }}
              className="border-border bg-secondary relative h-[42px] w-14 flex-none cursor-pointer overflow-hidden rounded border no-underline"
            >
              {previewable && (
                <AssetImage
                  publicId={sibling.publicId}
                  preset="lafken:thumbnail"
                  alt=""
                  className="absolute inset-0 h-full w-full bg-black object-contain"
                />
              )}
              {sibling.state === "processing" && (
                <span
                  className={cn(
                    "absolute inset-0",
                    "bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.18)_0_4px,transparent_4px_8px)]",
                  )}
                />
              )}
              <span className="absolute bottom-0.5 left-1 rounded-sm bg-black/45 px-1 font-mono text-[9.5px] tracking-wider text-white">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
