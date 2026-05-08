import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, ChevronRight, RefreshCw } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAsset } from "@/features/assets/hooks/useAssets";
import { DEMO_NOTIFICATIONS } from "@/lib/demo/lafken-notifications";
import { cn } from "@/lib/utils";

import { LanguageSelector } from "./LanguageSelector";
import { NotificationsPanel } from "./NotificationsPanel";

interface IBreadcrumb {
  label: string;
  href?: string;
}

function buildCrumbs(
  pathname: string,
  t: (key: string) => string,
  assetDetailLabel: string | null,
): IBreadcrumb[] {
  if (pathname === "/" || pathname === "") return [{ label: t("nav.home") }];
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "assets") {
    if (parts.length === 1) return [{ label: t("nav.assets") }];
    // Detail routes use the internal uuidv7 as the URL param; we surface the
    // external publicId (uuidv4) in the breadcrumb so it matches the page UI.
    // Fall back to the URL slug while the asset query is still loading or the
    // asset turns out not to exist.
    return [
      { label: t("nav.assets"), href: "/assets" },
      { label: assetDetailLabel ?? parts[1] ?? "" },
    ];
  }
  if (parts[0] === "namespaces") {
    if (parts.length === 1) return [{ label: t("nav.namespaces") }];
    return [{ label: t("nav.namespaces"), href: "/namespaces" }, { label: parts[1] ?? "" }];
  }
  if (parts[0] === "quarantine") return [{ label: t("nav.quarantine") }];
  if (parts[0] === "legal-holds") return [{ label: t("nav.legalHolds") }];
  if (parts[0] === "audit") return [{ label: t("nav.audit") }];
  if (parts[0] === "system") return [{ label: t("nav.system") }];
  if (parts[0] === "settings") return [{ label: t("nav.settings") }];
  return [{ label: parts[0] ?? "" }];
}

/**
 * When the current route is `/assets/<id>` returns the asset's external
 * publicId (uuidv4) so the breadcrumb can show the user-facing identifier
 * instead of the internal admin uuidv7 baked into the URL. Reuses the same
 * query key as AssetDetailPage so this is a cache read after first paint,
 * not a second network round-trip.
 */
function useAssetBreadcrumbLabel(pathname: string): string | null {
  const parts: string[] = pathname.split("/").filter(Boolean);
  const onAssetDetail: boolean = parts[0] === "assets" && parts.length >= 2;
  const assetId: string = onAssetDetail ? (parts[1] ?? "") : "";
  const { data } = useAsset(assetId);
  if (!onAssetDetail) return null;
  return data?.publicId ?? null;
}

export function TopBar(): React.ReactElement {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (routerState) => routerState.location.pathname });
  const assetDetailLabel: string | null = useAssetBreadcrumbLabel(pathname);
  const crumbs = buildCrumbs(pathname, t, assetDetailLabel);

  const [notifOpen, setNotifOpen] = useState(false);
  const bellRef = useRef<HTMLButtonElement>(null);
  const hasUnread = DEMO_NOTIFICATIONS.some((notif) => notif.unread);

  return (
    <header className="border-border bg-card sticky top-0 z-20 flex h-[52px] flex-none items-center gap-4 border-b px-6">
      <nav
        className="text-muted-foreground flex flex-wrap items-center gap-2 text-[13px]"
        aria-label="Breadcrumbs"
      >
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <span key={`${crumb.label}-${i}`} className="flex items-center gap-2">
              {i > 0 && <ChevronRight size={12} className="text-foreground/30" aria-hidden />}
              {crumb.href !== undefined && !isLast ? (
                <Link to={crumb.href} className="hover:text-latam-indigo cursor-pointer">
                  {crumb.label}
                </Link>
              ) : (
                <span className={isLast ? "text-foreground" : ""}>{crumb.label}</span>
              )}
            </span>
          );
        })}
      </nav>

      <div className="flex-1" />

      <LanguageSelector />

      <button
        type="button"
        title={t("topBar.refresh")}
        className="border-border bg-card text-muted-foreground hover:border-latam-indigo/30 hover:bg-secondary hover:text-latam-indigo grid size-8 cursor-pointer place-items-center rounded border"
      >
        <RefreshCw size={14} />
      </button>

      <div className="relative">
        <button
          ref={bellRef}
          type="button"
          onClick={() => {
            setNotifOpen((prev) => !prev);
          }}
          title={t("topBar.notifications")}
          aria-expanded={notifOpen}
          className={cn(
            "border-border bg-card text-muted-foreground hover:border-latam-indigo/30 hover:bg-secondary hover:text-latam-indigo relative grid size-8 cursor-pointer place-items-center rounded border",
            notifOpen && "border-latam-indigo/40 bg-secondary text-latam-indigo",
          )}
        >
          <Bell size={14} />
          {hasUnread && (
            <span className="bg-latam-pink absolute top-1 right-1 size-1.5 rounded-full" />
          )}
        </button>
        <NotificationsPanel
          open={notifOpen}
          onClose={() => {
            setNotifOpen(false);
          }}
          anchorRef={bellRef}
        />
      </div>
    </header>
  );
}
