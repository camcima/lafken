import { useState } from "react";

import { DEMO_ASSET_DETAIL } from "@/lib/demo/lafken-demo-data";

import { ActionBar } from "./action-bar";
import { AnalysesCard } from "./analyses-card";
import { CaptureCard } from "./capture-card";
import { FilePropsCard } from "./file-props-card";
import { IdentityCard } from "./identity-card";
import { MetadataCard } from "./metadata-card";
import { PresetsCard } from "./presets-card";
import { StateHero } from "./state-hero";
import { Timeline } from "./timeline";
import { VisualBlock } from "./visual-block";

interface IAssetDetailPageProps {
  // publicId is intentionally unused in Slice 0 — the BE returns 404 for all detail requests
  // so we always render the canonical demo asset regardless of the route param.
  publicId: string;
}

interface IToast {
  id: number;
  message: string;
}

const TOAST_DURATION_MS = 2000;
let toastCounter = 0;

export function AssetDetailPage(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _props: IAssetDetailPageProps,
): React.JSX.Element {
  // Slice 0: BE returns 404 for all detail requests; rendering canonical demo asset
  const asset = DEMO_ASSET_DETAIL;
  const [toasts, setToasts] = useState<IToast[]>([]);

  const handleCopy = (text: string, label: string): void => {
    void navigator.clipboard.writeText(text).catch(() => undefined);
    const id = ++toastCounter;
    setToasts((prev) => [...prev, { id, message: label }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, TOAST_DURATION_MS);
  };

  return (
    <div className="space-y-5">
      {/* Toast notifications */}
      {toasts.length > 0 && (
        <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="border-ok-line bg-ok-soft text-ok rounded-md border px-3 py-2 text-[12.5px] shadow-md"
            >
              {toast.message}
            </div>
          ))}
        </div>
      )}

      {/* Action bar */}
      <ActionBar asset={asset} onCopy={handleCopy} />

      {/* State hero */}
      <StateHero state={asset.state} />

      {/* Visual block */}
      <VisualBlock asset={asset} />

      {/* Identity + File props two-up */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <IdentityCard asset={asset} onCopy={handleCopy} />
        <FilePropsCard asset={asset} onCopy={handleCopy} />
      </div>

      {/* Timeline */}
      <Timeline asset={asset} />

      {/* Analyses */}
      <AnalysesCard asset={asset} />

      {/* Metadata + Capture context two-up */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <MetadataCard asset={asset} />
        <CaptureCard asset={asset} />
      </div>

      {/* Presets / Available URLs */}
      <PresetsCard asset={asset} onCopy={handleCopy} />
    </div>
  );
}
