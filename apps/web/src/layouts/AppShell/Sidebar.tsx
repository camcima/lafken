import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { useDashboardOverview } from "@/features/dashboard/hooks/useDashboardOverview";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

import type { INavGroup, INavLink } from "./nav-config";
import { NAV_GROUPS } from "./nav-config";
import { UserBlock } from "./UserBlock";

const MAX_BADGE_COUNT = 99;

function NavLinkItem({
  link,
  isActive,
  count,
}: {
  link: INavLink;
  isActive: boolean;
  count?: number;
}) {
  const { t } = useTranslation();
  const Icon = link.icon;

  return (
    <Link
      to={link.to}
      className={cn(
        "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-neutral-800 text-white"
          : "text-neutral-400 hover:bg-neutral-800 hover:text-white",
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0",
          isActive ? "text-white" : "text-neutral-400 group-hover:text-white",
        )}
      />
      <span className="flex-1 truncate">{t(link.labelKey)}</span>
      {count !== undefined && count > 0 && (
        <span className="bg-coral-500 ml-auto flex size-5 items-center justify-center rounded-full text-xs font-semibold text-white">
          {count > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : count}
        </span>
      )}
    </Link>
  );
}

function NavGroupSection({
  group,
  currentPath,
  getCounts,
  userRoles,
}: {
  group: INavGroup;
  currentPath: string;
  getCounts: (key: string) => number | undefined;
  userRoles: string[];
}) {
  const { t } = useTranslation();

  const visibleLinks = group.links.filter((link) => {
    if (!link.requiredRoles) return true;
    return link.requiredRoles.some((role) => userRoles.includes(role));
  });

  if (visibleLinks.length === 0) return null;

  return (
    <div className="space-y-1">
      <p className="px-3 py-1 text-xs font-semibold tracking-wider text-neutral-500 uppercase">
        {t(group.headingKey)}
      </p>
      <nav className="space-y-0.5">
        {visibleLinks.map((link) => (
          <NavLinkItem
            key={link.id}
            link={link}
            isActive={
              currentPath === link.to || (link.to !== "/" && currentPath.startsWith(link.to))
            }
            count={link.countKey !== undefined ? getCounts(link.countKey) : undefined}
          />
        ))}
      </nav>
    </div>
  );
}

export function Sidebar() {
  const { user } = useAuth();
  const { data: overview } = useDashboardOverview();
  const currentPath = useRouterState({ select: (state) => state.location.pathname });

  const userRoles: string[] = user?.roles ?? [];

  const getCounts = (key: string): number | undefined => {
    if (!overview) return undefined;
    if (key === "quarantine")
      return (overview as { counts?: { quarantine?: number } }).counts?.quarantine ?? 0;
    if (key === "legalHolds")
      return (overview as { counts?: { legalHolds?: number } }).counts?.legalHolds ?? 0;
    return undefined;
  };

  return (
    <aside data-testid="app-sidebar" className="flex h-full w-60 flex-col bg-neutral-900">
      {/* Brand */}
      <div className="flex h-14 shrink-0 items-center px-4">
        <span className="text-lg font-bold tracking-tight text-white">LAFKEN</span>
      </div>

      {/* Nav groups */}
      <div className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => (
          <NavGroupSection
            key={group.id}
            group={group}
            currentPath={currentPath}
            getCounts={getCounts}
            userRoles={userRoles}
          />
        ))}
      </div>

      {/* User block at the bottom */}
      <div className="shrink-0">
        <UserBlock />
      </div>
    </aside>
  );
}
