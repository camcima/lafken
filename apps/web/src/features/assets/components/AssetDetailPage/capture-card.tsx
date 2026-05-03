import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/common/Card/Card";
import { CardHeader } from "@/components/common/Card/CardHeader";
import { CardMeta } from "@/components/common/Card/CardMeta";
import { CardTitle } from "@/components/common/Card/CardTitle";
import type { IDemoAssetDetail } from "@/lib/demo/lafken-demo-data";

import { DLRow } from "./dl-row";

const GEO_PRECISION = 4;

interface ICaptureCardProps {
  asset: IDemoAssetDetail;
}

export function CaptureCard({ asset }: ICaptureCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const ctx = asset.captureContext;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("pages.assetDetail.sections.captureContext")}</CardTitle>
        <CardMeta>{t("pages.assetDetail.sections.captureContextMeta")}</CardMeta>
      </CardHeader>
      <div className="px-5 py-3">
        <DLRow label={t("pages.assetDetail.dl.capturedAt")}>
          <span className="font-mono text-[12px]">{ctx.captured_at.replace("T", " ")}</span>
        </DLRow>
        <DLRow label={t("pages.assetDetail.dl.device")}>
          {ctx.device.make} {ctx.device.model} · {ctx.device.os}
        </DLRow>
        <DLRow label={t("pages.assetDetail.dl.app")}>
          <span className="font-mono text-[11.5px]">{ctx.app.id}</span>
          <span className="text-foreground/30 mx-1.5">·</span>
          <span className="text-muted-foreground font-mono text-[11.5px]">v{ctx.app.version}</span>
        </DLRow>
        <DLRow label={t("pages.assetDetail.dl.network")} last>
          <span className="font-mono text-[11.5px]">{ctx.network}</span>
        </DLRow>

        {/* Map placeholder */}
        <div className="mt-3">
          <div className="border-border bg-secondary/50 relative h-24 overflow-hidden rounded border">
            {/* Static map placeholder */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="border-latam-pink bg-latam-pink/30 size-3 rounded-full border-2" />
            </div>
            <div className="text-foreground absolute bottom-1.5 left-2 rounded-sm bg-white/75 px-1.5 font-mono text-[10px] dark:bg-black/60 dark:text-white">
              {ctx.capture_location.lat.toFixed(GEO_PRECISION)}°,{" "}
              {ctx.capture_location.lng.toFixed(GEO_PRECISION)}° · ±
              {ctx.capture_location.accuracy_m}m
            </div>
          </div>
          <div className="text-muted-foreground mt-1.5 flex items-center gap-1.5 text-[11px]">
            <Info size={11} />
            {t("pages.assetDetail.sections.captureLocationNote")}
          </div>
        </div>
      </div>
    </Card>
  );
}
