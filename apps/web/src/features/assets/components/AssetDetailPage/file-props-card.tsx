import type { AssetResponseDTO } from "@shared/backend-api";
import { Copy } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/common/Badge/Badge";
import { Card } from "@/components/common/Card/Card";
import { CardContent } from "@/components/common/Card/CardContent";
import { CardHeader } from "@/components/common/Card/CardHeader";
import { CardTitle } from "@/components/common/Card/CardTitle";
import { fmtBytes } from "@/lib/utils";

import { DLRow } from "./dl-row";

interface IFilePropsCardProps {
  asset: AssetResponseDTO;
  onCopy: (text: string, label: string) => void;
}

export function FilePropsCard({ asset, onCopy }: IFilePropsCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const same: boolean =
    asset.declaredMimeType !== undefined &&
    asset.mimeType !== undefined &&
    asset.declaredMimeType === asset.mimeType;
  const hasDims: boolean = asset.width !== undefined && asset.height !== undefined;
  const emptyDash: string = "—";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("pages.assetDetail.sections.fileProperties")}</CardTitle>
      </CardHeader>
      <CardContent className="px-5 py-3">
        <DLRow label={t("pages.assetDetail.dl.dimensions")}>
          <span className="font-mono text-[12px]">
            {hasDims ? `${String(asset.width)} × ${String(asset.height)}` : emptyDash}
          </span>
        </DLRow>
        <DLRow label={t("pages.assetDetail.dl.size")}>
          <span className="font-mono text-[12px]">
            {asset.sizeBytes !== undefined ? fmtBytes(asset.sizeBytes) : emptyDash}
          </span>
        </DLRow>
        <DLRow label={t("pages.assetDetail.dl.mime")}>
          {asset.mimeType !== undefined ? (
            <span className="inline-flex items-center gap-2">
              <span className="font-mono text-[12px]">{asset.mimeType}</span>
              {asset.declaredMimeType !== undefined &&
                (same ? (
                  <Badge variant="ok" className="text-[10px]">
                    {t("pages.assetDetail.mime.detectedEqualsDeclared")}
                  </Badge>
                ) : (
                  <Badge variant="warn" className="text-[10px]">
                    {t("pages.assetDetail.mime.declaredOther", {
                      declared: asset.declaredMimeType,
                    })}
                  </Badge>
                ))}
            </span>
          ) : (
            <span className="text-muted-foreground text-[12px]">{emptyDash}</span>
          )}
        </DLRow>
        <DLRow label={t("pages.assetDetail.dl.contentHash")} last>
          {asset.contentHashHex !== undefined ? (
            <span className="inline-flex items-center gap-1">
              <span className="font-mono text-[11px] break-all">sha256:{asset.contentHashHex}</span>
              <button
                type="button"
                onClick={() => {
                  onCopy(
                    `sha256:${asset.contentHashHex ?? ""}`,
                    t("pages.assetDetail.toasts.hashCopied"),
                  );
                }}
                className="text-muted-foreground hover:bg-secondary hover:text-foreground rounded p-0.5"
              >
                <Copy size={12} />
              </button>
            </span>
          ) : (
            <span className="text-muted-foreground text-[12px]">{emptyDash}</span>
          )}
        </DLRow>
      </CardContent>
    </Card>
  );
}
