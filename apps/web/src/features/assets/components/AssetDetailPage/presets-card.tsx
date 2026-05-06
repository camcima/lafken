import { useAssetPresetUrl } from "@lafken/react";
import type { AssetResponseDTO, NamespacePresetResponseDTO } from "@shared/backend-api";
import { Copy, ExternalLink, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card/Card";
import { CardHeader } from "@/components/common/Card/CardHeader";
import { CardTitle } from "@/components/common/Card/CardTitle";
import { useNamespacePresets } from "@/features/namespaces/hooks/useNamespaces";

interface IPresetsCardProps {
  asset: AssetResponseDTO;
  onToast: (message: string) => void;
}

interface IPresetEntry {
  name: string;
  params: Record<string, unknown>;
}

/**
 * System-managed presets, available across every namespace.
 *
 * Mirrored from `apps/backend/src/assets/infrastructure/services/system-presets.ts`.
 * The FE keeps its own copy because the BE doesn't (yet) expose the system
 * preset list in the namespace presets response — system presets are
 * code-defined and silent, applied uniformly per asset.
 */
const SYSTEM_PRESETS: ReadonlyArray<IPresetEntry> = [
  {
    name: "lafken:thumbnail",
    params: { width: 200, height: 200, fit: "contain", format: "webp", quality: 80 },
  },
  {
    name: "lafken:detail-hero",
    params: { width: 1200, fit: "contain", format: "webp", quality: 85 },
  },
];

function buildSummary(params: Record<string, unknown>): string {
  const width = typeof params["width"] === "number" ? params["width"] : undefined;
  const height = typeof params["height"] === "number" ? params["height"] : undefined;
  const format = typeof params["format"] === "string" ? params["format"] : "";
  const quality = typeof params["quality"] === "number" ? params["quality"] : undefined;

  const parts: string[] = [];
  if (width !== undefined && height !== undefined) {
    parts.push(`${width}×${height}`);
  } else if (width !== undefined) {
    parts.push(`${width}×—`);
  } else if (height !== undefined) {
    parts.push(`—×${height}`);
  }
  if (format) parts.push(format);
  if (quality !== undefined) parts.push(`q${quality}`);
  return parts.join(" · ");
}

/**
 * Combine system presets with the namespace's active presets, keeping only
 * the highest-version row for each name. System presets win on collision —
 * defensive only, since the BE prevents namespaces from registering names
 * with the `lafken:` prefix.
 */
function combinePresets(namespacePresets: NamespacePresetResponseDTO[]): IPresetEntry[] {
  const byName = new Map<string, IPresetEntry>();
  for (const sys of SYSTEM_PRESETS) {
    byName.set(sys.name, sys);
  }
  const latestByName = new Map<string, NamespacePresetResponseDTO>();
  for (const preset of namespacePresets) {
    if (!preset.active) continue;
    const existing = latestByName.get(preset.name);
    if (!existing || preset.version > existing.version) {
      latestByName.set(preset.name, preset);
    }
  }
  for (const [name, preset] of latestByName) {
    if (!byName.has(name)) {
      byName.set(name, { name, params: preset.params });
    }
  }
  return Array.from(byName.values());
}

interface IPresetRowProps {
  asset: AssetResponseDTO;
  preset: IPresetEntry;
  onToast: (message: string) => void;
}

function PresetRow({ asset, preset, onToast }: IPresetRowProps): React.JSX.Element {
  const { t } = useTranslation();
  const { url, isLoading, error } = useAssetPresetUrl(asset.publicId, preset.name);
  const summary: string = buildSummary(preset.params);
  const ready: boolean = url !== null && !isLoading;

  const onCopy = (): void => {
    if (!url) return;
    void navigator.clipboard.writeText(url).catch(() => undefined);
    onToast(t("pages.assetDetail.presets.toasts.urlCopied", { name: preset.name }));
  };

  const onOpen = (): void => {
    if (!url) return;
    window.open(url, "_blank", "noopener");
  };

  return (
    <div className="border-border/40 flex items-center gap-4 border-b px-5 py-3 last:border-b-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="font-mono text-[13px] font-semibold">{preset.name}</span>
        <div className="flex items-center gap-2">
          {summary ? (
            <span className="text-muted-foreground font-mono text-[11px]">{summary}</span>
          ) : null}
          {error !== null && (
            <span className="text-danger font-mono text-[11px]">
              {t("pages.assetDetail.presets.error")}
            </span>
          )}
        </div>
      </div>
      <Button variant="outline" size="sm" disabled={!ready} onClick={onCopy}>
        {isLoading ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
        {t("pages.assetDetail.presets.copyUrl")}
      </Button>
      <Button variant="outline" size="sm" disabled={!ready} onClick={onOpen}>
        <ExternalLink size={13} />
        {t("pages.assetDetail.presets.openUrl")}
      </Button>
    </div>
  );
}

export function PresetsCard({ asset, onToast }: IPresetsCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const { data: namespacePresets } = useNamespacePresets(asset.namespaceSlug);
  const presets: IPresetEntry[] = combinePresets(namespacePresets ?? []);

  return (
    <Card className="p-0">
      <CardHeader>
        <CardTitle>{t("pages.assetDetail.sections.availableUrls")}</CardTitle>
      </CardHeader>
      {presets.length === 0 ? (
        <div className="text-muted-foreground px-5 py-4 text-[12.5px]">
          {t("pages.assetDetail.presets.empty")}
        </div>
      ) : (
        <div>
          {presets.map((preset) => (
            <PresetRow key={preset.name} asset={asset} preset={preset} onToast={onToast} />
          ))}
        </div>
      )}
    </Card>
  );
}
