import { useRouterState } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/common/Button";

/**
 * Maps a pathname to an i18n title key.
 * Falls back to the last path segment if no explicit mapping exists.
 */
function getPageTitleKey(pathname: string): string {
  if (pathname === "/" || pathname === "") return "pages.home.title";
  if (pathname.startsWith("/assets")) return "pages.assets.title";
  if (pathname.startsWith("/namespaces")) return "pages.namespaces.title";
  if (pathname.startsWith("/quarantine")) return "pages.quarantine.title";
  if (pathname.startsWith("/legal-holds")) return "pages.legalHolds.title";
  if (pathname.startsWith("/audit")) return "pages.audit.title";
  if (pathname.startsWith("/system")) return "pages.system.title";
  if (pathname.startsWith("/settings")) return "pages.settings.title";
  return "pages.home.title";
}

export function TopBar() {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const titleKey = getPageTitleKey(pathname);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-6">
      <h1 className="text-base font-semibold text-neutral-900">{t(titleKey)}</h1>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("topBar.refresh")}
          onClick={() => {
            globalThis.location.reload();
          }}
        >
          <RefreshCw className="size-4" />
        </Button>
      </div>
    </header>
  );
}
