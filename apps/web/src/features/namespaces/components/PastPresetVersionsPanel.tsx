import type { NamespacePresetResponseDTO } from "@shared/backend-api";
import React from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/common/Badge";
import { Card, CardHeader, CardTitle } from "@/components/common/Card";
import { cn } from "@/lib/utils";

interface IPastPresetVersionsPanelProps {
  presets: NamespacePresetResponseDTO[];
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

export function PastPresetVersionsPanel({
  presets,
  selectedVersion,
  onSelectVersion,
}: IPastPresetVersionsPanelProps): React.JSX.Element {
  const { t } = useTranslation();

  const sorted = [...presets].sort((a, b) => b.version - a.version);
  const latestVersion = sorted[0]?.version;

  return (
    <Card className="p-0">
      <CardHeader>
        <CardTitle>{t("pages.namespaces.presets.history.title")}</CardTitle>
      </CardHeader>

      {sorted.length === 0 ? (
        <div className="text-muted-foreground px-5 py-8 text-center text-[12.5px]">
          {t("pages.namespaces.presets.history.empty")}
        </div>
      ) : (
        <div>
          {latestVersion !== undefined && selectedVersion !== latestVersion && (
            <div className="border-border/40 border-b px-5 py-2.5">
              <button
                type="button"
                onClick={() => {
                  onSelectVersion(latestVersion);
                }}
                className="text-muted-foreground hover:text-foreground text-[11.5px] underline-offset-2 hover:underline"
              >
                {t("pages.namespaces.presets.history.backToLatest")}
              </button>
            </div>
          )}

          {sorted.map((preset) => {
            const isSelected = preset.version === selectedVersion;
            return (
              <button
                key={preset.version}
                type="button"
                aria-pressed={isSelected}
                onClick={() => {
                  onSelectVersion(preset.version);
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
                  {t("pages.namespaces.presets.version", { version: preset.version })}
                </span>
                <span className="text-muted-foreground flex-1 font-mono text-[11px]">
                  {fmtDate(preset.createdAt)}
                </span>
                {preset.active ? (
                  <Badge variant="ok">{t("pages.namespaces.presets.active")}</Badge>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}
