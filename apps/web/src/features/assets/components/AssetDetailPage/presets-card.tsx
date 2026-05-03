import { Eye, Link } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/common/Card/Card";
import { CardHeader } from "@/components/common/Card/CardHeader";
import { CardMeta } from "@/components/common/Card/CardMeta";
import { CardTitle } from "@/components/common/Card/CardTitle";
import type { IDemoAssetDetail, IDemoAssetDetailPreset } from "@/lib/demo/lafken-demo-data";
import { fmtNum } from "@/lib/utils";

interface IPresetsCardProps {
  asset: IDemoAssetDetail;
  onCopy: (text: string, label: string) => void;
}

function getExt(spec: string): string {
  if (spec.includes("AVIF")) return "avif";
  if (spec.includes("WEBP")) return "webp";
  return "jpg";
}

interface IPresetRowProps {
  preset: IDemoAssetDetailPreset;
  cdnUrl: string;
  onCopy: (text: string, label: string) => void;
}

function PresetRow({ preset, cdnUrl, onCopy }: IPresetRowProps): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="border-border/40 grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_auto_auto_auto] items-center gap-3 border-b px-5 py-2 text-[12.5px] last:border-b-0">
      <span className="truncate font-mono text-[12px]" title={preset.name}>
        {preset.name}
      </span>
      <span className="text-muted-foreground truncate text-[12px]" title={preset.spec}>
        {preset.spec}
      </span>
      <span className="text-muted-foreground text-right font-mono text-[11.5px] whitespace-nowrap">
        {t("pages.assetDetail.presets.hits", { count: fmtNum(preset.hits) })}
      </span>
      <span className="text-ok text-[11.5px] whitespace-nowrap">
        ● {t("pages.assetDetail.presets.ready")}
      </span>
      <span className="flex justify-end gap-1">
        <button
          type="button"
          className="text-muted-foreground hover:bg-secondary hover:text-foreground grid size-7 place-items-center rounded"
          title={t("pages.assetDetail.presets.preview")}
        >
          <Eye size={13} />
        </button>
        <button
          type="button"
          onClick={() => {
            onCopy(cdnUrl, t("pages.assetDetail.toasts.urlCopied", { name: preset.name }));
          }}
          className="text-muted-foreground hover:bg-secondary hover:text-foreground grid size-7 place-items-center rounded"
          title={t("pages.assetDetail.presets.copyUrl")}
        >
          <Link size={13} />
        </button>
      </span>
    </div>
  );
}

export function PresetsCard({ asset, onCopy }: IPresetsCardProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("pages.assetDetail.sections.availableUrls")}</CardTitle>
        <CardMeta>
          {t("pages.assetDetail.sections.availableUrlsMeta", { count: asset.presets.length })}
        </CardMeta>
      </CardHeader>
      <div className="overflow-x-auto py-1">
        <div className="min-w-[640px]">
          {asset.presets.map((preset) => {
            const ext = getExt(preset.spec);
            const cdnUrl = `https://${asset.cdnHost}/${asset.namespace.slug}/${asset.shortId}/${preset.name}.${ext}?sig=…`;
            return <PresetRow key={preset.name} preset={preset} cdnUrl={cdnUrl} onCopy={onCopy} />;
          })}
        </div>
      </div>
    </Card>
  );
}
