import { useTranslation } from "react-i18next";

import { Card } from "@/components/common/Card/Card";
import { CardHeader } from "@/components/common/Card/CardHeader";
import { CardMeta } from "@/components/common/Card/CardMeta";
import { CardTitle } from "@/components/common/Card/CardTitle";
import type { IDemoAssetDetail, IDemoAssetDetailTimeline } from "@/lib/demo/lafken-demo-data";
import { cn } from "@/lib/utils";

interface ITimelineProps {
  asset: IDemoAssetDetail;
}

const KIND_COLOR: Record<IDemoAssetDetailTimeline["kind"], string> = {
  uploaded: "text-info",
  processing: "text-info",
  analysis: "text-ok",
  ready: "text-ok",
  failure: "text-danger",
};

const KIND_SOLID: Array<IDemoAssetDetailTimeline["kind"]> = ["ready", "failure"];

export function Timeline({ asset }: ITimelineProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("pages.assetDetail.sections.timeline")}</CardTitle>
        <CardMeta>
          {t("pages.assetDetail.sections.timelineMeta", { count: asset.timeline.length })}
        </CardMeta>
      </CardHeader>
      <div className="px-5 py-3">
        {asset.timeline.map((e, i) => (
          <div key={`${e.at}-${e.kind}`} className="grid grid-cols-[18px_1fr] gap-3 py-2">
            <div className="relative">
              <div
                className={cn(
                  "mt-1 size-[10px] rounded-full border-2",
                  KIND_SOLID.includes(e.kind)
                    ? cn("border-current", KIND_COLOR[e.kind])
                    : cn("bg-background border-current", KIND_COLOR[e.kind]),
                )}
              />
              {i < asset.timeline.length - 1 && (
                <div className="bg-border absolute top-[18px] bottom-[-8px] left-[4px] w-px" />
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-[12.5px] font-medium">{e.label}</span>
                <span className="text-latam-indigo font-mono text-[11px]">{e.actor}</span>
                <span className="text-muted-foreground ml-auto font-mono text-[11px]">
                  {e.at.replace("T", " ")}
                </span>
              </div>
              <div className="text-muted-foreground text-[12px] leading-relaxed">{e.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
