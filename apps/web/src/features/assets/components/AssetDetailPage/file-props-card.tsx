import { Copy } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/common/Badge/Badge";
import { Card } from "@/components/common/Card/Card";
import { CardContent } from "@/components/common/Card/CardContent";
import { CardHeader } from "@/components/common/Card/CardHeader";
import { CardTitle } from "@/components/common/Card/CardTitle";
import type { IDemoAssetDetail } from "@/lib/demo/lafken-demo-data";
import { fmtBytes } from "@/lib/utils";

import { DLRow } from "./dl-row";

interface IFilePropsCardProps {
  asset: IDemoAssetDetail;
  onCopy: (text: string, label: string) => void;
}

export function FilePropsCard({ asset, onCopy }: IFilePropsCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const same = asset.declaredMime === asset.detectedMime;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("pages.assetDetail.sections.fileProperties")}</CardTitle>
      </CardHeader>
      <CardContent className="px-5 py-3">
        <DLRow label={t("pages.assetDetail.dl.filename")}>
          <span className="font-mono text-[11.5px] break-all">{asset.filename}</span>
        </DLRow>
        <DLRow label={t("pages.assetDetail.dl.dimensions")}>
          <span className="font-mono text-[12px]">
            {asset.dimensions.width} × {asset.dimensions.height}
          </span>
        </DLRow>
        <DLRow label={t("pages.assetDetail.dl.format")}>
          <span className="font-mono text-[12px]">JPEG (baseline, 4:2:0)</span>
        </DLRow>
        <DLRow label={t("pages.assetDetail.dl.size")}>
          <span className="font-mono text-[12px]">{fmtBytes(asset.fileSize)}</span>
        </DLRow>
        <DLRow label={t("pages.assetDetail.dl.mime")}>
          <span className="inline-flex items-center gap-2">
            <span className="font-mono text-[12px]">{asset.detectedMime}</span>
            {same ? (
              <Badge variant="ok" className="text-[10px]">
                {t("pages.assetDetail.mime.detectedEqualsDeclared")}
              </Badge>
            ) : (
              <Badge variant="warn" className="text-[10px]">
                {t("pages.assetDetail.mime.declaredOther", { declared: asset.declaredMime })}
              </Badge>
            )}
          </span>
        </DLRow>
        <DLRow label={t("pages.assetDetail.dl.contentHash")} last>
          <span className="inline-flex items-center gap-1">
            <span className="font-mono text-[11px] break-all">{asset.contentHash}</span>
            <button
              type="button"
              onClick={() => {
                onCopy(asset.contentHash, t("pages.assetDetail.toasts.hashCopied"));
              }}
              className="text-muted-foreground hover:bg-secondary hover:text-foreground rounded p-0.5"
            >
              <Copy size={12} />
            </button>
          </span>
        </DLRow>
      </CardContent>
    </Card>
  );
}
