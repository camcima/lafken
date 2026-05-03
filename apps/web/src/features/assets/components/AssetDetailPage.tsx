import { Link } from "@tanstack/react-router";
import React from "react";
import { useTranslation } from "react-i18next";

import { EmptyState } from "@/components/common/EmptyState";
import { IdChip } from "@/components/common/IdChip";
import { useAsset } from "@/features/assets/hooks/useAssets";

interface IAssetDetailPageProps {
  publicId: string;
}

export function AssetDetailPage({ publicId }: IAssetDetailPageProps): React.JSX.Element {
  const { t } = useTranslation();
  const { data: asset, isLoading, error } = useAsset(publicId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-neutral-500">{t("pages.assetDetail.loading")}</p>
      </div>
    );
  }

  if (!asset || error) {
    return (
      <div className="space-y-4">
        <EmptyState
          title={t("pages.assetDetail.notFound.title")}
          description={t("pages.assetDetail.notFound.description")}
          action={
            <Link
              to="/assets"
              className="bg-background hover:bg-accent hover:text-accent-foreground inline-flex items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium whitespace-nowrap shadow-xs transition-all"
            >
              {t("pages.assetDetail.notFound.action")}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-[22px] font-bold tracking-tight text-neutral-900">
          {t("pages.assetDetail.title")}
        </h1>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Thumbnail placeholder */}
        <div
          data-testid="asset-thumb-placeholder"
          className="flex h-48 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-100"
        />

        {/* Identity card */}
        <div className="space-y-4 lg:col-span-2">
          <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-medium text-neutral-900">
              {t("pages.assetDetail.sections.identity")}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <IdChip id={asset.publicId} />
            </div>
          </section>

          {/* File properties */}
          <section className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-medium text-neutral-900">
              {t("pages.assetDetail.sections.fileProperties")}
            </h2>
            <table className="w-full text-xs">
              <tbody className="divide-y divide-neutral-100">
                <tr>
                  <td className="py-1.5 pr-4 font-medium text-neutral-500">Namespace</td>
                  <td className="py-1.5 text-neutral-900">{asset.namespaceSlug}</td>
                </tr>
                <tr>
                  <td className="py-1.5 pr-4 font-medium text-neutral-500">State</td>
                  <td className="py-1.5 text-neutral-900">{asset.state}</td>
                </tr>
                {asset.mimeType && (
                  <tr>
                    <td className="py-1.5 pr-4 font-medium text-neutral-500">MIME type</td>
                    <td className="py-1.5 font-mono text-neutral-900">{asset.mimeType}</td>
                  </tr>
                )}
                {asset.sizeBytes !== undefined && (
                  <tr>
                    <td className="py-1.5 pr-4 font-medium text-neutral-500">Size</td>
                    <td className="py-1.5 text-neutral-900">{asset.sizeBytes} bytes</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </div>
      </div>

      {/* Timeline */}
      <section className="rounded-lg border border-neutral-200 bg-white shadow-sm">
        <header className="border-b border-neutral-200 px-5 py-3">
          <h2 className="text-sm font-medium text-neutral-900">
            {t("pages.assetDetail.sections.timeline")}
          </h2>
        </header>
        <EmptyState title={t("pages.assetDetail.sections.timeline")} className="py-8" />
      </section>

      {/* Analyses */}
      <section className="rounded-lg border border-neutral-200 bg-white shadow-sm">
        <header className="border-b border-neutral-200 px-5 py-3">
          <h2 className="text-sm font-medium text-neutral-900">
            {t("pages.assetDetail.sections.analyses")}
          </h2>
        </header>
        <EmptyState title={t("pages.assetDetail.sections.analyses")} className="py-8" />
      </section>

      {/* Presets */}
      <section className="rounded-lg border border-neutral-200 bg-white shadow-sm">
        <header className="border-b border-neutral-200 px-5 py-3">
          <h2 className="text-sm font-medium text-neutral-900">
            {t("pages.assetDetail.sections.presets")}
          </h2>
        </header>
        <EmptyState title={t("pages.assetDetail.sections.presets")} className="py-8" />
      </section>
    </div>
  );
}
