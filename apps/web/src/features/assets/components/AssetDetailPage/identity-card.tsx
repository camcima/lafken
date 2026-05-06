import type { AssetResponseDTO } from "@shared/backend-api";
import { Copy, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/common/Card/Card";
import { CardContent } from "@/components/common/Card/CardContent";
import { CardHeader } from "@/components/common/Card/CardHeader";
import { CardTitle } from "@/components/common/Card/CardTitle";

import { DLRow } from "./dl-row";

interface IIdentityCardProps {
  asset: AssetResponseDTO;
  onCopy: (text: string, label: string) => void;
}

function fmtDate(value?: string): string {
  if (value === undefined) return "—";
  return value.replace("T", " ").replace("Z", " UTC");
}

export function IdentityCard({ asset, onCopy }: IIdentityCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const hasExternalRef: boolean =
    asset.externalRefType !== undefined && asset.externalRefId !== undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("pages.assetDetail.sections.identityLineage")}</CardTitle>
      </CardHeader>
      <CardContent className="px-5 py-3">
        <DLRow label={t("pages.assetDetail.dl.publicId")}>
          <span className="inline-flex items-center gap-1">
            <span className="font-mono text-[12px]">{asset.publicId}</span>
            <button
              type="button"
              onClick={() => {
                onCopy(asset.publicId, t("pages.assetDetail.toasts.idCopied"));
              }}
              className="text-muted-foreground hover:bg-secondary hover:text-foreground rounded p-0.5"
            >
              <Copy size={12} />
            </button>
          </span>
        </DLRow>
        <DLRow label={t("pages.assetDetail.dl.namespace")}>
          <span className="text-latam-indigo font-mono">{asset.namespaceSlug}</span>
        </DLRow>
        <DLRow label={t("pages.assetDetail.dl.policyVersion")}>
          <span className="text-latam-indigo font-mono">v{asset.policyVersion}</span>
          <span className="text-muted-foreground/60 ml-2 font-mono text-[10px] tracking-wider uppercase">
            {t("pages.assetDetail.mime.governing")}
          </span>
        </DLRow>
        <DLRow label={t("pages.assetDetail.dl.externalRef")}>
          {hasExternalRef ? (
            <span className="inline-flex items-center gap-1">
              <span className="text-latam-indigo font-mono">
                {asset.externalRefType}/{asset.externalRefId}
              </span>
              <ExternalLink size={11} className="text-muted-foreground" />
            </span>
          ) : (
            <span className="text-muted-foreground text-[12px]">
              {t("pages.assetDetail.empty.noExternalRef")}
            </span>
          )}
        </DLRow>
        <DLRow label={t("pages.assetDetail.dl.uploadedBy")}>
          {asset.uploadedBy !== undefined ? (
            <span className="text-muted-foreground font-mono text-[11.5px]">
              {asset.uploadedBy}
            </span>
          ) : (
            <span className="text-muted-foreground text-[12px]">
              {t("pages.assetDetail.empty.unknown")}
            </span>
          )}
        </DLRow>
        <DLRow label={t("pages.assetDetail.dl.uploadedAt")} last>
          <span className="font-mono text-[12px]">
            {fmtDate(asset.confirmedAt ?? asset.createdAt)}
          </span>
        </DLRow>
      </CardContent>
    </Card>
  );
}
