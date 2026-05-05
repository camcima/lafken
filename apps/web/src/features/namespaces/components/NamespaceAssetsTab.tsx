import type { NamespaceResponseDTO } from "@shared/backend-api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Card, CardHeader, CardTitle } from "@/components/common/Card";
import { EmptyState } from "@/components/common/EmptyState";
import { assetsService } from "@/services";

import { UploadAssetsDialog } from "./UploadAssetsDialog";

const PUBLIC_ID_PREFIX_LENGTH = 8;

const ASSETS_KEY = (slug: string): readonly ["namespaces", string, "assets"] =>
  ["namespaces", slug, "assets"] as const;

interface INamespaceAssetsTabProps {
  namespace: NamespaceResponseDTO;
}

export function NamespaceAssetsTab({ namespace }: INamespaceAssetsTabProps): React.JSX.Element {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ASSETS_KEY(namespace.slug),
    queryFn: () => assetsService.list({ namespaceSlug: namespace.slug, page: 1, limit: 50 }),
  });

  const isArchived = Boolean(namespace.archivedAt);
  const rows = data?.data ?? [];

  function onUploadComplete(): void {
    void queryClient.invalidateQueries({ queryKey: ASSETS_KEY(namespace.slug) });
    setDialogOpen(false);
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
        <Card className="p-0">
          <CardHeader>
            <CardTitle>{t("pages.namespaces.assets.list.columnFile")}</CardTitle>
          </CardHeader>
          <div>
            {rows.map((asset) => (
              <div
                key={asset.publicId}
                className="border-border/40 flex items-center gap-4 border-b px-5 py-3 last:border-b-0"
              >
                <span className="font-mono text-[12px]">
                  {asset.publicId.slice(0, PUBLIC_ID_PREFIX_LENGTH)}…
                </span>
                <span className="text-muted-foreground flex-1 truncate font-mono text-[11.5px]">
                  {asset.mimeType ?? asset.declaredMimeType ?? "—"}
                </span>
                <Badge variant="muted">{asset.state}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      <UploadAssetsDialog
        open={dialogOpen}
        namespaceSlug={namespace.slug}
        onClose={onUploadComplete}
      />
    </div>
  );
}
