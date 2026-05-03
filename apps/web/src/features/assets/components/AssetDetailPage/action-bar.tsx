import { Download, Lock, MoreVertical, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/common/Button";
import type { IDemoAssetDetail } from "@/lib/demo/lafken-demo-data";

interface IActionBarProps {
  asset: IDemoAssetDetail;
  onCopy: (text: string, label: string) => void;
}

export function ActionBar({ asset, onCopy }: IActionBarProps): React.JSX.Element {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = (): void => {
    setMenuOpen(false);
  };

  const toggleMenu = (): void => {
    setMenuOpen((prev) => !prev);
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button variant="outline" size="sm">
        <RefreshCw size={13} />
        {t("pages.assetDetail.actions.reProcess")}
      </Button>
      <Button variant="outline" size="sm">
        <Lock size={13} />
        {t("pages.assetDetail.actions.placeLegalHold")}
      </Button>
      <Button variant="pink" size="sm">
        <Download size={13} />
        {t("pages.assetDetail.actions.evidentiaryExport")}
      </Button>
      <div className="relative">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={toggleMenu}
          title={t("pages.assetDetail.actions.more")}
        >
          <MoreVertical size={14} />
        </Button>
        {menuOpen && (
          <>
            <button
              type="button"
              aria-label="Close menu"
              className="fixed inset-0 z-40 cursor-default"
              onClick={closeMenu}
            />
            <div className="border-border bg-popover absolute top-full right-0 z-50 mt-1 min-w-[200px] rounded-md border p-1 text-[12.5px] shadow-md">
              <button
                type="button"
                className="hover:bg-secondary flex w-full cursor-pointer items-center gap-2 rounded px-2.5 py-1.5"
                onClick={() => {
                  onCopy(asset.publicId, t("pages.assetDetail.toasts.idCopied"));
                  closeMenu();
                }}
              >
                Copy public ID
              </button>
              <button
                type="button"
                className="hover:bg-secondary flex w-full cursor-pointer items-center gap-2 rounded px-2.5 py-1.5"
              >
                Download original
              </button>
              <button
                type="button"
                className="hover:bg-secondary flex w-full cursor-pointer items-center gap-2 rounded px-2.5 py-1.5"
              >
                Open in API
              </button>
              <div className="bg-border my-1 h-px" />
              <button
                type="button"
                className="hover:bg-secondary flex w-full cursor-pointer items-center gap-2 rounded px-2.5 py-1.5"
              >
                View audit trail
              </button>
              <button
                type="button"
                className="hover:bg-secondary flex w-full cursor-pointer items-center gap-2 rounded px-2.5 py-1.5"
              >
                Edit metadata
              </button>
              <div className="bg-border my-1 h-px" />
              <button
                type="button"
                className="text-danger hover:bg-danger-soft flex w-full cursor-pointer items-center gap-2 rounded px-2.5 py-1.5"
              >
                Force expire…
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
