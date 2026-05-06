import type { AssetResponseDTO } from "@shared/backend-api";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/common/Card/Card";
import { CardHeader } from "@/components/common/Card/CardHeader";
import { CardMeta } from "@/components/common/Card/CardMeta";
import { CardTitle } from "@/components/common/Card/CardTitle";

interface IMetadataCardProps {
  asset: AssetResponseDTO;
}

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

export function MetadataCard({ asset }: IMetadataCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const entries: [string, unknown][] = Object.entries(asset.customMetadata);
  const fieldCount: number = entries.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("pages.assetDetail.sections.customMetadata")}</CardTitle>
        <CardMeta>
          {t("pages.assetDetail.sections.customMetadataMeta", { count: fieldCount })}
        </CardMeta>
      </CardHeader>
      {fieldCount === 0 ? (
        <div className="text-muted-foreground px-5 py-4 text-[12.5px]">
          {t("pages.assetDetail.empty.noCustomMetadata")}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-5 gap-y-2 p-5">
          {entries.map(([fieldName, fieldValue]) => (
            <div
              key={fieldName}
              className="border-border/60 flex flex-col gap-0.5 border-b border-dashed py-1.5"
            >
              <span className="text-muted-foreground flex items-center gap-1.5 text-[10.5px] tracking-wider uppercase">
                {fieldName}
              </span>
              <span className="font-mono text-[12px]">{formatFieldValue(fieldValue)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
