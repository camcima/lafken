import type { NamespacePolicyResponseDTO } from "@shared/backend-api";
import React from "react";
import { useTranslation } from "react-i18next";

import { Card, CardHeader, CardTitle } from "@/components/common/Card";
import { cn } from "@/lib/utils";

interface IPastVersionsPanelProps {
  policies: NamespacePolicyResponseDTO[];
  currentVersion: number;
  selectedVersion: number;
  onSelectVersion: (version: number) => void;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PastVersionsPanel({
  policies,
  currentVersion,
  selectedVersion,
  onSelectVersion,
}: IPastVersionsPanelProps): React.JSX.Element {
  const { t } = useTranslation();

  const sorted = [...policies].sort((a, b) => b.version - a.version);

  return (
    <Card className="p-0">
      <CardHeader>
        <CardTitle>{t("pages.namespaceDetail.policy.pastVersions.title")}</CardTitle>
      </CardHeader>

      {sorted.length === 0 ? (
        <div className="text-muted-foreground px-5 py-8 text-center text-[12.5px]">
          {t("pages.namespaceDetail.policy.pastVersions.empty")}
        </div>
      ) : (
        <div>
          {selectedVersion !== currentVersion && (
            <div className="border-border/40 border-b px-5 py-2.5">
              <button
                type="button"
                onClick={() => {
                  onSelectVersion(currentVersion);
                }}
                className="text-muted-foreground hover:text-foreground text-[11.5px] underline-offset-2 hover:underline"
              >
                {t("pages.namespaceDetail.policy.pastVersions.backToCurrent")}
              </button>
            </div>
          )}

          {sorted.map((policy) => {
            const isSelected = policy.version === selectedVersion;
            return (
              <button
                key={policy.version}
                type="button"
                aria-pressed={isSelected}
                onClick={() => {
                  onSelectVersion(policy.version);
                }}
                className={cn(
                  "border-border/40 flex w-full items-center gap-3 border-b px-5 py-2.5 text-left last:border-b-0",
                  "hover:bg-secondary/50 transition-colors",
                  isSelected && "border-l-latam-indigo bg-latam-indigo/5 border-l-2",
                )}
              >
                <span
                  className={cn(
                    "font-mono text-[12px] font-semibold",
                    isSelected ? "text-latam-indigo" : "text-foreground",
                  )}
                >
                  v{policy.version}
                </span>
                <span className="text-muted-foreground flex-1 font-mono text-[11px]">
                  {fmtDate(policy.createdAt)}
                </span>
                {policy.createdBy ? (
                  <span className="text-muted-foreground font-mono text-[11px]">
                    {policy.createdBy}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}
