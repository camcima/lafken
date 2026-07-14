import { RefreshCw, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { cn } from "@/lib/utils";

const ALERT_ICON_SIZE = 20;
const RETRY_ICON_SIZE = 12;

interface IListQueryErrorProps {
  onRetry: () => void;
  className?: string;
  /**
   * True while a retry request triggered by `onRetry` is in flight (e.g. the
   * owning query's `isFetching`). Disables the button and marks it
   * `aria-busy` so the retry affordance never looks clickable-but-inert.
   */
  isRetrying?: boolean;
}

/**
 * Error state for list pages (F-W4): shown when a list query fails, instead
 * of the misleading "no matches" empty state. Offers an explicit retry.
 */
export function ListQueryError({
  onRetry,
  className,
  isRetrying = false,
}: IListQueryErrorProps): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <Card role="alert" className={cn("px-8 py-16 text-center", className)}>
      <div className="bg-danger-soft text-danger mx-auto mb-3 grid size-12 place-items-center rounded-full">
        <TriangleAlert size={ALERT_ICON_SIZE} />
      </div>
      <div className="text-[14px] font-medium">{t("common.listError.title")}</div>
      <div className="text-muted-foreground mt-1 text-[12.5px]">
        {t("common.listError.description")}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="mt-4"
        onClick={onRetry}
        disabled={isRetrying}
        aria-busy={isRetrying}
      >
        <RefreshCw size={RETRY_ICON_SIZE} />
        {t("common.listError.retry")}
      </Button>
    </Card>
  );
}
