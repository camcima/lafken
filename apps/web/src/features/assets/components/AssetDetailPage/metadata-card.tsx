import { useTranslation } from "react-i18next";

import { Card } from "@/components/common/Card/Card";
import { CardHeader } from "@/components/common/Card/CardHeader";
import { CardMeta } from "@/components/common/Card/CardMeta";
import { CardTitle } from "@/components/common/Card/CardTitle";
import type { IDemoAssetDetail } from "@/lib/demo/lafken-demo-data";

interface IMetadataCardProps {
  asset: IDemoAssetDetail;
}

export function MetadataCard({ asset }: IMetadataCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const required = new Set(asset.metadataSchema.required);
  const fieldCount = Object.keys(asset.customMetadata).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("pages.assetDetail.sections.customMetadata")}</CardTitle>
        <CardMeta>
          {t("pages.assetDetail.sections.customMetadataMeta", { count: fieldCount })}
        </CardMeta>
      </CardHeader>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-5 gap-y-2 p-5">
        {Object.entries(asset.customMetadata).map(([fieldName, fieldValue]) => (
          <div
            key={fieldName}
            className="border-border/60 flex flex-col gap-0.5 border-b border-dashed py-1.5"
          >
            <span className="text-muted-foreground flex items-center gap-1.5 text-[10.5px] tracking-wider uppercase">
              {fieldName}
              {required.has(fieldName) && (
                <span className="text-ok font-mono text-[9.5px]">
                  {t("pages.assetDetail.mime.req")}
                </span>
              )}
            </span>
            <span className="font-mono text-[12px]">{String(fieldValue)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
