import type { AssetResponseDTO } from "@shared/backend-api";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/common/Card/Card";
import { CardHeader } from "@/components/common/Card/CardHeader";
import { CardMeta } from "@/components/common/Card/CardMeta";
import { CardTitle } from "@/components/common/Card/CardTitle";

interface ITagsCardProps {
  asset: AssetResponseDTO;
}

export function TagsCard({ asset }: ITagsCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const tags: string[] = asset.tags ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("pages.assetDetail.sections.tags")}</CardTitle>
        <CardMeta>{t("pages.assetDetail.sections.tagsMeta", { count: tags.length })}</CardMeta>
      </CardHeader>
      {tags.length === 0 ? (
        <div className="text-muted-foreground px-5 py-4 text-[12.5px]">
          {t("pages.assetDetail.empty.noTags")}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5 px-5 py-4">
          {tags.map((tag) => (
            <span
              key={tag}
              className="border-border bg-muted/40 text-foreground/90 rounded-full border px-2.5 py-0.5 text-[11.5px]"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}
