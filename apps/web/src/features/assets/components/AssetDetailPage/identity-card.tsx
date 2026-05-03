import { Copy, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/common/Card/Card";
import { CardContent } from "@/components/common/Card/CardContent";
import { CardHeader } from "@/components/common/Card/CardHeader";
import { CardTitle } from "@/components/common/Card/CardTitle";
import type { IDemoAssetDetail } from "@/lib/demo/lafken-demo-data";

import { DLRow } from "./dl-row";

interface IIdentityCardProps {
  asset: IDemoAssetDetail;
  onCopy: (text: string, label: string) => void;
}

export function IdentityCard({ asset, onCopy }: IIdentityCardProps): React.JSX.Element {
  const { t } = useTranslation();

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
          <span className="text-latam-indigo font-mono">{asset.namespace.slug}</span>
          <span className="text-foreground/30 mx-1.5">·</span>
          <span className="text-muted-foreground">{asset.namespace.displayName}</span>
        </DLRow>
        <DLRow label={t("pages.assetDetail.dl.policyVersion")}>
          <span className="text-latam-indigo font-mono">v{asset.policyVersion}</span>
          <span className="text-muted-foreground/60 ml-2 font-mono text-[10px] tracking-wider uppercase">
            {t("pages.assetDetail.mime.governing")}
          </span>
        </DLRow>
        <DLRow label={t("pages.assetDetail.dl.storageBinding")}>
          <span className="font-mono text-[12px]">{asset.storageBinding}</span>
        </DLRow>
        <DLRow label={t("pages.assetDetail.dl.owningRecord")}>
          <span className="inline-flex items-center gap-1">
            <span className="text-latam-indigo font-mono">
              {asset.owningRecord.type}/{asset.owningRecord.id}
            </span>
            <ExternalLink size={11} className="text-muted-foreground" />
          </span>
        </DLRow>
        <DLRow label={t("pages.assetDetail.dl.uploadedBy")}>
          <span className="text-latam-indigo">{asset.uploadedBy.displayName}</span>
          <span className="text-foreground/30 mx-1.5">·</span>
          <span className="text-muted-foreground font-mono text-[11.5px]">
            {asset.uploadedBy.principal}
          </span>
        </DLRow>
        <DLRow label={t("pages.assetDetail.dl.uploadedAt")} last>
          <span className="font-mono text-[12px]">{asset.uploadedAtLocal}</span>
        </DLRow>
      </CardContent>
    </Card>
  );
}
