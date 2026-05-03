import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/common/Badge/Badge";
import { Card } from "@/components/common/Card/Card";
import { CardHeader } from "@/components/common/Card/CardHeader";
import { CardMeta } from "@/components/common/Card/CardMeta";
import { CardTitle } from "@/components/common/Card/CardTitle";
import type { IDemoAssetDetail, IDemoAssetDetailAnalysis } from "@/lib/demo/lafken-demo-data";
import { cn } from "@/lib/utils";

interface IAnalysisItemProps {
  analysis: IDemoAssetDetailAnalysis;
  defaultOpen?: boolean;
}

type VerdictVariant = "ok" | "info" | "danger" | "warn";

const VERDICT_VARIANT: Record<IDemoAssetDetailAnalysis["verdict"], VerdictVariant> = {
  passed: "ok",
  info: "info",
  failed: "danger",
  warning: "warn",
};

const PCT_MAX = 100;
const JSON_INDENT = 2;
const TIME_SLICE_END = 8;
const SCORE_PRECISION = 3;

function ModerationBars({ raw }: { raw: IDemoAssetDetailAnalysis["raw"] }): React.JSX.Element {
  const categories = raw.categories as Record<string, number>;
  const threshold = raw.threshold as number;
  const decision = raw.decision as string;

  return (
    <div className="mt-2.5">
      {Object.entries(categories).map(([categoryName, score]) => {
        const pct = (score / threshold) * PCT_MAX;
        const over = score >= threshold;
        return (
          <div
            key={categoryName}
            className="grid grid-cols-[88px_1fr_48px] items-center gap-2.5 py-0.5 text-[12px]"
          >
            <span className="text-muted-foreground capitalize">{categoryName}</span>
            <div className="bg-secondary relative h-1.5 overflow-hidden rounded-full">
              <div
                className={cn("h-full rounded-full", over ? "bg-danger" : "bg-ok")}
                style={{ width: `${String(Math.min(PCT_MAX, pct))}%` }}
              />
              <div className="bg-foreground/40 absolute top-[-2px] right-0 bottom-[-2px] w-px" />
            </div>
            <span className="text-muted-foreground text-right font-mono text-[11px]">
              {score.toFixed(SCORE_PRECISION)}
            </span>
          </div>
        );
      })}
      <div className="text-muted-foreground mt-1.5 text-[11px]">
        Threshold: {threshold} · Decision: <b className="text-ok">{decision}</b>
      </div>
    </div>
  );
}

function AnalysisItem({ analysis, defaultOpen = false }: IAnalysisItemProps): React.JSX.Element {
  const [open, setOpen] = useState(defaultOpen);
  const isMod = analysis.id === "moderation";
  const variant: VerdictVariant = VERDICT_VARIANT[analysis.verdict];

  return (
    <div className="border-border bg-secondary/40 mt-2 rounded border first:mt-0">
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
        }}
        className="hover:bg-secondary flex w-full items-center gap-2.5 px-3 py-2.5 text-left"
      >
        <ChevronRight
          size={12}
          className={cn("text-muted-foreground transition-transform", open && "rotate-90")}
        />
        <span className="text-[12.5px] font-medium">{analysis.name}</span>
        <Badge variant={variant} className="text-[10px]">
          {analysis.verdict}
        </Badge>
        <span className="text-muted-foreground flex-1 truncate text-[12px]">
          {analysis.summary}
        </span>
        <span className="text-muted-foreground font-mono text-[11px]">
          {analysis.at.split("T")[1]?.slice(0, TIME_SLICE_END) ?? ""}
        </span>
      </button>
      {open && (
        <div className="border-border border-t border-dashed px-3 pb-3">
          {isMod && <ModerationBars raw={analysis.raw} />}
          <pre className="bg-secondary/60 text-muted-foreground mt-2.5 overflow-x-auto rounded p-2.5 font-mono text-[11px]">
            {JSON.stringify(analysis.raw, null, JSON_INDENT)}
          </pre>
        </div>
      )}
    </div>
  );
}

interface IAnalysesCardProps {
  asset: IDemoAssetDetail;
}

export function AnalysesCard({ asset }: IAnalysesCardProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("pages.assetDetail.sections.analyses")}</CardTitle>
        <CardMeta>
          {t("pages.assetDetail.sections.analysesMeta", { count: asset.analyses.length })}
        </CardMeta>
      </CardHeader>
      <div className="px-5 py-3">
        {asset.analyses.map((analysis) => (
          <AnalysisItem
            key={analysis.id}
            analysis={analysis}
            defaultOpen={analysis.id === "moderation"}
          />
        ))}
      </div>
    </Card>
  );
}
