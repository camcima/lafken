import type { AssetResponseDTO } from "@shared/backend-api";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, Download, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/common/Button";
import { DeleteAssetDialog } from "@/features/assets/components/DeleteAssetDialog";
import { useDeleteAsset } from "@/features/assets/hooks/useDeleteAsset";
import { assetsKeys } from "@/features/assets/keys";
import { getLafkenClient } from "@/lib/lafken-client";

interface IActionBarProps {
  asset: AssetResponseDTO;
  onCopy: (text: string, label: string) => void;
  onToast: (message: string) => void;
}

export function ActionBar({ asset, onCopy, onToast }: IActionBarProps): React.JSX.Element {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const showRetry: boolean = asset.state === "processing_failed";
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const deleteAsset = useDeleteAsset();
  const showDelete: boolean = asset.state !== "deleted";

  const handleDeleteConfirm = (): void => {
    deleteAsset.mutate(
      { id: asset.id },
      {
        onSuccess: () => {
          setIsDeleteOpen(false);
          onToast(t("pages.assetDetail.delete.toasts.deleted"));
        },
      },
    );
  };

  const handleDeleteClose = (): void => {
    setIsDeleteOpen(false);
    deleteAsset.reset();
  };

  const handleDownload = async (): Promise<void> => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const client = getLafkenClient();
      const { url } = await client.assets.getDownloadUrl({ publicId: asset.publicId });
      // Open in a new tab; some browsers honour the storage object's
      // Content-Disposition for inline rendering, others trigger a download.
      // The user can then "Save as…" if needed. window.location.href would
      // navigate away from the page, which is worse UX than a new tab.
      window.open(url, "_blank", "noopener");
    } catch {
      onToast(t("pages.assetDetail.actions.toasts.downloadFailed"));
    } finally {
      setIsDownloading(false);
    }
  };

  const handleRetry = async (): Promise<void> => {
    if (isRetrying) return;
    setIsRetrying(true);
    try {
      const client = getLafkenClient();
      await client.assets.retryProcessing(asset.id);
      onToast(t("pages.assetDetail.actions.toasts.retryStarted"));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: assetsKeys.detail(asset.id) }),
        queryClient.invalidateQueries({ queryKey: assetsKeys.stateTransitions(asset.id) }),
        queryClient.invalidateQueries({ queryKey: assetsKeys.processingJob(asset.id) }),
      ]);
    } catch {
      onToast(t("pages.assetDetail.actions.toasts.retryFailed"));
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          onCopy(asset.publicId, t("pages.assetDetail.toasts.idCopied"));
        }}
      >
        <Copy size={13} />
        {t("pages.assetDetail.actions.menu.copyPublicId")}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          void handleDownload();
        }}
        disabled={isDownloading}
        aria-busy={isDownloading}
      >
        {isDownloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
        {t("pages.assetDetail.actions.menu.downloadOriginal")}
      </Button>
      {showRetry && (
        <Button
          variant="indigo"
          size="sm"
          onClick={() => {
            void handleRetry();
          }}
          disabled={isRetrying}
          aria-busy={isRetrying}
        >
          {isRetrying ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          {t("pages.assetDetail.actions.menu.retryProcessing")}
        </Button>
      )}
      {showDelete && (
        <Button
          variant="destructive"
          size="sm"
          onClick={() => {
            setIsDeleteOpen(true);
          }}
        >
          <Trash2 size={13} />
          {t("pages.assetDetail.actions.menu.delete")}
        </Button>
      )}
      <DeleteAssetDialog
        open={isDeleteOpen}
        publicId={asset.publicId}
        isPending={deleteAsset.isPending}
        errorMessage={deleteAsset.error ? t("pages.assetDetail.delete.toasts.failed") : undefined}
        onConfirm={handleDeleteConfirm}
        onClose={handleDeleteClose}
      />
    </div>
  );
}
