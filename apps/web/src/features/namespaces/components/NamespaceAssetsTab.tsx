import type { NamespaceResponseDTO } from "@shared/backend-api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { EmptyState } from "@/components/common/EmptyState";
import { assetResponseToRow, type IAssetRow } from "@/features/assets/asset-row";
import { AssetsListView, type ViewMode } from "@/features/assets/components/assets-list-view";
import { assetsService } from "@/services";

import { UploadAssetsDialog } from "./UploadAssetsDialog";

const ASSETS_KEY = (slug: string): readonly ["namespaces", string, "assets"] =>
  ["namespaces", slug, "assets"] as const;

const PAGE_SIZE = 50;

interface INamespaceAssetsTabProps {
  namespace: NamespaceResponseDTO;
}

export function NamespaceAssetsTab({ namespace }: INamespaceAssetsTabProps): React.JSX.Element {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const view: ViewMode = "rows";
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const { data, isLoading } = useQuery({
    queryKey: ASSETS_KEY(namespace.slug),
    queryFn: () => assetsService.list({ namespaceSlug: namespace.slug, page: 1, limit: PAGE_SIZE }),
  });

  const isArchived = Boolean(namespace.archivedAt);
  const rows: IAssetRow[] = useMemo(() => (data?.data ?? []).map(assetResponseToRow), [data]);

  function onUploadComplete(): void {
    void queryClient.invalidateQueries({ queryKey: ASSETS_KEY(namespace.slug) });
    setDialogOpen(false);
  }

  function handleToggleOne(rowKey: string, checked: boolean): void {
    const next = new Set(selected);
    if (checked) {
      next.add(rowKey);
    } else {
      next.delete(rowKey);
    }
    setSelected(next);
  }

  function handleToggleAll(checked: boolean): void {
    setSelected(checked ? new Set(rows.map((row) => row.rowKey)) : new Set());
  }

  if (isLoading) {
    return (
      <Card>
        <div className="text-muted-foreground px-6 py-8 text-center text-[14px]">
          {t("pages.namespaceDetail.loading")}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-semibold">{t("pages.namespaces.assets.title")}</h2>
        <Button
          type="button"
          variant="indigo"
          disabled={isArchived}
          onClick={() => {
            setDialogOpen(true);
          }}
        >
          {t("pages.namespaces.assets.upload.cta")}
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={t("pages.namespaces.assets.empty.title")}
          description={t("pages.namespaces.assets.empty.body")}
        />
      ) : (
        <AssetsListView
          rows={rows}
          view={view}
          selected={selected}
          onToggleOne={handleToggleOne}
          onToggleAll={handleToggleAll}
        />
      )}

      <UploadAssetsDialog
        open={dialogOpen}
        namespaceSlug={namespace.slug}
        onClose={onUploadComplete}
      />
    </div>
  );
}
