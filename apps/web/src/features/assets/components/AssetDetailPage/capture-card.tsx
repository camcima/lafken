import type { AssetResponseDTO } from "@shared/backend-api";
import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/common/Card/Card";
import { CardHeader } from "@/components/common/Card/CardHeader";
import { CardMeta } from "@/components/common/Card/CardMeta";
import { CardTitle } from "@/components/common/Card/CardTitle";

import { DLRow } from "./dl-row";

const GEO_PRECISION = 4;

interface ICaptureCardProps {
  asset: AssetResponseDTO;
}

interface ICaptureLocation {
  lat?: number;
  lng?: number;
  redacted?: boolean;
  accuracy_m?: number;
}

interface ICaptureDevice {
  make?: string;
  model?: string;
  os?: string;
}

interface ICaptureApp {
  id?: string;
  version?: string;
  build?: string;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

export function CaptureCard({ asset }: ICaptureCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const ctx: Record<string, unknown> | undefined = asset.captureContext;

  if (ctx === undefined || Object.keys(ctx).length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("pages.assetDetail.sections.captureContext")}</CardTitle>
          <CardMeta>{t("pages.assetDetail.sections.captureContextMeta")}</CardMeta>
        </CardHeader>
        <div className="text-muted-foreground px-5 py-4 text-[12.5px]">
          {t("pages.assetDetail.empty.noCaptureContext")}
        </div>
      </Card>
    );
  }

  const capturedAt = asString(ctx.captured_at);
  const device: ICaptureDevice = asObject(ctx.device) ?? {};
  const deviceMake = asString(device.make);
  const deviceModel = asString(device.model);
  const deviceOs = asString(device.os);
  const app: ICaptureApp = asObject(ctx.app) ?? {};
  const appId = asString(app.id);
  const appVersion = asString(app.version);
  const network = asString(ctx.network);
  const location: ICaptureLocation = asObject(ctx.capture_location) ?? {};
  const lat = asNumber(location.lat);
  const lng = asNumber(location.lng);
  const accuracy = asNumber(location.accuracy_m);
  const hasLocation: boolean = lat !== undefined && lng !== undefined;
  const dash = "—";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("pages.assetDetail.sections.captureContext")}</CardTitle>
        <CardMeta>{t("pages.assetDetail.sections.captureContextMeta")}</CardMeta>
      </CardHeader>
      <div className="px-5 py-3">
        <DLRow label={t("pages.assetDetail.dl.capturedAt")}>
          <span className="font-mono text-[12px]">
            {capturedAt !== undefined ? capturedAt.replace("T", " ") : dash}
          </span>
        </DLRow>
        <DLRow label={t("pages.assetDetail.dl.device")}>
          {deviceMake !== undefined || deviceModel !== undefined || deviceOs !== undefined
            ? `${deviceMake ?? ""} ${deviceModel ?? ""}${deviceOs !== undefined ? ` · ${deviceOs}` : ""}`.trim()
            : dash}
        </DLRow>
        <DLRow label={t("pages.assetDetail.dl.app")}>
          {appId !== undefined || appVersion !== undefined ? (
            <>
              {appId !== undefined && <span className="font-mono text-[11.5px]">{appId}</span>}
              {appId !== undefined && appVersion !== undefined && (
                <span className="text-foreground/30 mx-1.5">·</span>
              )}
              {appVersion !== undefined && (
                <span className="text-muted-foreground font-mono text-[11.5px]">v{appVersion}</span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground text-[12px]">{dash}</span>
          )}
        </DLRow>
        <DLRow label={t("pages.assetDetail.dl.network")} last>
          <span className="font-mono text-[11.5px]">{network ?? dash}</span>
        </DLRow>

        {hasLocation && (
          <div className="mt-3">
            <div className="border-border bg-secondary/50 relative h-24 overflow-hidden rounded border">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="border-latam-pink bg-latam-pink/30 size-3 rounded-full border-2" />
              </div>
              <div className="text-foreground absolute bottom-1.5 left-2 rounded-sm bg-white/75 px-1.5 font-mono text-[10px] dark:bg-black/60 dark:text-white">
                {lat !== undefined ? lat.toFixed(GEO_PRECISION) : "—"}°,{" "}
                {lng !== undefined ? lng.toFixed(GEO_PRECISION) : "—"}°
                {accuracy !== undefined ? ` · ±${String(accuracy)}m` : ""}
              </div>
            </div>
            <div className="text-muted-foreground mt-1.5 flex items-center gap-1.5 text-[11px]">
              <Info size={11} />
              {t("pages.assetDetail.sections.captureLocationNote")}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
