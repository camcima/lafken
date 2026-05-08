import type {
  AssetAnalysisResponseDTO,
  AssetResponseDTO,
  AssetStateTransitionResponseDTO,
  ProcessingJobResponseDTO,
} from "@shared/backend-api";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  useAsset,
  useAssetAnalyses,
  useAssetProcessingJob,
  useAssets,
  useAssetStateTransitions,
} from "@/features/assets/hooks/useAssets";
import { ApiError } from "@/lib/api/api-error";

import { ActionBar } from "./action-bar";
import { AnalysesCard } from "./analyses-card";
import { CaptureCard } from "./capture-card";
import { FilePropsCard } from "./file-props-card";
import { IdentityCard } from "./identity-card";
import { MetadataCard } from "./metadata-card";
import { PresetsCard } from "./presets-card";
import { SiblingStrip } from "./sibling-strip";
import { StateHero } from "./state-hero";
import { Timeline } from "./timeline";
import { VisualBlock } from "./visual-block";

interface IAssetDetailPageProps {
  publicId: string;
}

interface IToast {
  id: string;
  message: string;
}

const TOAST_DURATION_MS = 2000;
const HTTP_NOT_FOUND = 404;

function isNotFoundError(err: unknown): boolean {
  return err instanceof ApiError && err.status === HTTP_NOT_FOUND;
}

export function AssetDetailPage({ publicId }: IAssetDetailPageProps): React.JSX.Element {
  const { t } = useTranslation();
  const assetQuery = useAsset(publicId);
  const transitionsQuery = useAssetStateTransitions(publicId);
  const analysesQuery = useAssetAnalyses(publicId);
  const processingJobQuery = useAssetProcessingJob(publicId);

  const asset: AssetResponseDTO | undefined = assetQuery.data;
  const externalRefType = asset?.externalRefType;
  const externalRefId = asset?.externalRefId;
  const namespaceSlug = asset?.namespaceSlug;

  const siblingsQuery = useAssets(
    namespaceSlug !== undefined && externalRefType !== undefined && externalRefId !== undefined
      ? { namespaceSlug, externalRefType, externalRefId }
      : {},
  );
  const canFetchSiblings: boolean =
    namespaceSlug !== undefined && externalRefType !== undefined && externalRefId !== undefined;
  const siblings: AssetResponseDTO[] =
    canFetchSiblings && siblingsQuery.data
      ? siblingsQuery.data.data.filter((sibling) => sibling.publicId !== asset?.publicId)
      : [];

  const [toasts, setToasts] = useState<IToast[]>([]);

  const showToast = (message: string): void => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, TOAST_DURATION_MS);
  };

  const handleCopy = (text: string, label: string): void => {
    void navigator.clipboard.writeText(text).catch(() => undefined);
    showToast(label);
  };

  if (assetQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-muted-foreground text-[13px]">
          {t("pages.assetDetail.loadingAsset")}
        </div>
      </div>
    );
  }

  if (assetQuery.error && isNotFoundError(assetQuery.error)) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
        <div className="text-foreground text-[16px] font-semibold">
          {t("pages.assetDetail.notFound.title")}
        </div>
        <div className="text-muted-foreground max-w-md text-center text-[13px]">
          {t("pages.assetDetail.notFound.description")}
        </div>
        <Link
          to="/assets"
          className="text-latam-indigo hover:text-latam-indigo-deep text-[13px] underline-offset-4 hover:underline"
        >
          {t("pages.assetDetail.notFound.action")}
        </Link>
      </div>
    );
  }

  if (assetQuery.error || !asset) {
    return (
      <div className="border-danger-line bg-danger-soft text-danger rounded-md border px-4 py-3 text-[13px]">
        {t("pages.assetDetail.errorLoading")}
      </div>
    );
  }

  const stateTransitions: AssetStateTransitionResponseDTO[] = transitionsQuery.data ?? [];
  const analyses: AssetAnalysisResponseDTO[] = analysesQuery.data ?? [];
  const processingJob: ProcessingJobResponseDTO | undefined = processingJobQuery.data;

  return (
    <div className="space-y-5">
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

      <ActionBar asset={asset} onCopy={handleCopy} onToast={showToast} />

      <StateHero
        state={asset.state}
        legalHold={asset.legalHold}
        legalHoldReference={asset.legalHoldReference ?? null}
      />

      <VisualBlock asset={asset} />

      <SiblingStrip siblings={siblings} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <IdentityCard asset={asset} onCopy={handleCopy} />
        <FilePropsCard asset={asset} onCopy={handleCopy} />
      </div>

      <Timeline transitions={stateTransitions} processingJob={processingJob} />

      <AnalysesCard analyses={analyses} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <MetadataCard asset={asset} />
        <CaptureCard asset={asset} />
      </div>

      <PresetsCard asset={asset} onToast={showToast} />
    </div>
  );
}
