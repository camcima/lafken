import { useTranslation } from "react-i18next";

import { Card } from "@/components/common/Card/Card";
import { CardHeader } from "@/components/common/Card/CardHeader";
import { CardTitle } from "@/components/common/Card/CardTitle";

export function PresetsCard(): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("pages.assetDetail.sections.availableUrls")}</CardTitle>
      </CardHeader>
      <div className="text-muted-foreground px-5 py-4 text-[12.5px]">
        {t("pages.assetDetail.empty.presetsComingSoon")}
      </div>
    </Card>
  );
}
