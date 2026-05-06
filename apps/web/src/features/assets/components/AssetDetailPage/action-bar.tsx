import type { AssetResponseDTO } from "@shared/backend-api";
import { Copy, Download } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/common/Button";

interface IActionBarProps {
  asset: AssetResponseDTO;
  onCopy: (text: string, label: string) => void;
}

export function ActionBar({ asset, onCopy }: IActionBarProps): React.JSX.Element {
  const { t } = useTranslation();

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
      <Button variant="outline" size="sm" disabled>
        <Download size={13} />
        {t("pages.assetDetail.actions.menu.downloadOriginal")}
      </Button>
    </div>
  );
}
