import type { AssetAnalysisResponseDTO } from "@shared/backend-api";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/common/Badge/Badge";
import { Card } from "@/components/common/Card/Card";
import { CardHeader } from "@/components/common/Card/CardHeader";
import { CardMeta } from "@/components/common/Card/CardMeta";
import { CardTitle } from "@/components/common/Card/CardTitle";
import { cn } from "@/lib/utils";

type DecisionVariant = "ok" | "info" | "danger" | "warn";

const DECISION_VARIANT: Record<
  NonNullable<AssetAnalysisResponseDTO["decision"]>,
  DecisionVariant
> = {
  pass: "ok",
  flag: "warn",
  quarantine: "danger",
  error: "danger",
};

const JSON_INDENT = 2;
const TIME_SLICE_END = 8;

interface IAnalysisItemProps {
  analysis: AssetAnalysisResponseDTO;
  defaultOpen?: boolean;
}

function summarize(findings: Record<string, unknown>): string {
  const keys: string[] = Object.keys(findings);
  if (keys.length === 0) return "";
  const preferredKeys: string[] = ["summary", "message", "decision", "result"];
  for (const key of preferredKeys) {
    const value = findings[key];
    if (typeof value === "string" && value !== "") return value;
  }
  return `${String(keys.length)} fields`;
}

function AnalysisItem({ analysis, defaultOpen = false }: IAnalysisItemProps): React.JSX.Element {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);
  const decision = analysis.decision;
  const variant: DecisionVariant = decision !== undefined ? DECISION_VARIANT[decision] : "info";
  const summary: string = summarize(analysis.findings);
  const versionLabel: string =
    analysis.analyzerVersion !== undefined
      ? `${analysis.analyzer} · ${analysis.analyzerVersion}`
      : analysis.analyzer;

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
        <span className="text-[12.5px] font-medium">{versionLabel}</span>
        {decision !== undefined && (
          <Badge variant={variant} className="text-[10px]">
            {decision}
          </Badge>
        )}
        <span className="text-muted-foreground flex-1 truncate text-[12px]">{summary}</span>
        <span className="text-muted-foreground font-mono text-[11px]">
          {analysis.occurredAt.split("T")[1]?.slice(0, TIME_SLICE_END) ?? ""}
        </span>
      </button>
      {open && (
        <div className="border-border border-t border-dashed px-3 pb-3">
          <pre className="bg-secondary/60 text-muted-foreground mt-2.5 overflow-x-auto rounded p-2.5 font-mono text-[11px]">
            {JSON.stringify(analysis.findings, null, JSON_INDENT)}
          </pre>
          <div className="text-muted-foreground/80 mt-1 text-right font-mono text-[10.5px]">
            {t("pages.assetDetail.analyses.occurredAt")}: {analysis.occurredAt}
          </div>
        </div>
      )}
    </div>
  );
}

interface IAnalysesCardProps {
  analyses: AssetAnalysisResponseDTO[];
}

export function AnalysesCard({ analyses }: IAnalysesCardProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("pages.assetDetail.sections.analyses")}</CardTitle>
        <CardMeta>
          {t("pages.assetDetail.sections.analysesMeta", { count: analyses.length })}
        </CardMeta>
      </CardHeader>
      <div className="px-5 py-3">
        {analyses.length === 0 ? (
          <div className="text-muted-foreground text-[12.5px]">
            {t("pages.assetDetail.empty.noAnalyses")}
          </div>
        ) : (
          analyses.map((analysis, idx) => (
            <AnalysisItem
              key={`${analysis.analyzer}-${analysis.occurredAt}-${String(idx)}`}
              analysis={analysis}
              defaultOpen={idx === 0}
            />
          ))
        )}
      </div>
    </Card>
  );
}
