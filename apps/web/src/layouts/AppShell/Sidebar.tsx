import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { useDashboardOverview } from "@/features/dashboard/hooks/useDashboardOverview";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

import type { INavGroup, INavLink } from "./nav-config";
import { NAV_GROUPS } from "./nav-config";

const MAX_BADGE = 99;

function NavLinkItem({
  link,
  isActive,
  count,
}: {
  link: INavLink;
  isActive: boolean;
  count?: number;
}): React.ReactElement {
  const { t } = useTranslation();
  const Icon = link.icon;
  const showBadge = count !== undefined && count > 0;

  return (
    <Link
      to={link.to}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded px-2.5 py-1.5 text-[13px] no-underline select-none",
        isActive
          ? "bg-latam-pink font-medium text-white"
          : "text-white/75 hover:bg-white/10 hover:text-white",
      )}
    >
      <Icon size={15} className={isActive ? "text-white" : "text-white/65"} />
      <span className="flex-1">{t(link.labelKey)}</span>
      {showBadge && (
        <span
          className={cn(
            "ml-auto rounded-full px-1.5 py-px text-[10.5px] font-medium tabular-nums",
            isActive ? "bg-white/25 text-white" : "bg-white/15 text-white/85",
          )}
        >
          {count > MAX_BADGE ? `${MAX_BADGE}+` : count}
        </span>
      )}
    </Link>
  );
}

function NavGroupSection({
  group,
  currentPath,
  getCount,
  userRoles,
  isFirst,
}: {
  group: INavGroup;
  currentPath: string;
  getCount: (key: string) => number | undefined;
  userRoles: string[];
  isFirst: boolean;
}): React.ReactElement | null {
  const { t } = useTranslation();

  const visibleLinks = group.links.filter(
    (link) => !link.requiredRoles || link.requiredRoles.some((role) => userRoles.includes(role)),
  );

  if (visibleLinks.length === 0) return null;

  return (
    <div className={cn("px-3", !isFirst && "mt-3 border-t border-white/10 pt-3")}>
      <div className="px-2 py-1 text-[10px] font-medium tracking-[0.1em] text-white/45 uppercase">
        {t(group.headingKey)}
      </div>
      {visibleLinks.map((link) => {
        const isActive = link.to === "/" ? currentPath === "/" : currentPath.startsWith(link.to);
        return (
          <NavLinkItem
            key={link.id}
            link={link}
            isActive={isActive}
            count={link.countKey !== undefined ? getCount(link.countKey) : undefined}
          />
        );
      })}
    </div>
  );
}

function UserBlock(): React.ReactElement {
  const { user } = useAuth();
  const { t } = useTranslation();

  const initials = (user?.name ?? user?.email ?? "?")
    .split(/\s+/)
    .map((part: string) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const role = user?.roles?.[0] ?? t("user.noRole");

  return (
    <div className="flex items-center gap-2.5 border-t border-white/10 px-5 pt-3 text-[12px] text-white/70">
      <div className="bg-latam-pink grid size-[26px] flex-none place-items-center rounded-full text-[10.5px] font-bold text-white">
        {initials}
      </div>
      <div className="min-w-0">
        <div className="truncate text-[12.5px] leading-tight font-medium text-white">
          {user?.name ?? user?.email}
        </div>
        <div className="truncate text-[10.5px] leading-tight text-white/55">{role}</div>
      </div>
    </div>
  );
}

export function Sidebar(): React.ReactElement {
  const { user } = useAuth();
  const pathname = useRouterState({ select: (routerState) => routerState.location.pathname });
  const { data } = useDashboardOverview();
  const counts = (data as { counts?: { quarantine?: number; legalHolds?: number } } | undefined)
    ?.counts;

  const getCount = (key: string): number | undefined => {
    if (key === "quarantine") return counts?.quarantine;
    if (key === "legalHolds") return counts?.legalHolds;
    return undefined;
  };

  const roles: string[] = user?.roles ?? [];

  return (
    <aside
      data-testid="app-sidebar"
      className="border-latam-indigo-deep bg-latam-indigo sticky top-0 flex h-screen w-[232px] flex-none flex-col gap-2 overflow-y-auto border-r px-0 pt-4 pb-3 text-white"
    >
      {/* Brand block */}
      <div className="mb-2 flex items-center gap-2.5 border-b border-white/10 px-5 pb-4">
        <div className="bg-latam-pink grid size-7 flex-none place-items-center rounded-full text-[13px] font-bold text-white">
          L
        </div>
        <div>
          <div className="text-[15px] font-bold tracking-wide text-white uppercase">LAFKEN</div>
          <div className="mt-0.5 font-mono text-[9.5px] tracking-wider text-white/55 uppercase">
            prod · sa-east-1
          </div>
        </div>
      </div>

      {/* Nav groups */}
      {NAV_GROUPS.map((group, idx) => (
        <NavGroupSection
          key={group.id}
          group={group}
          currentPath={pathname}
          getCount={getCount}
          userRoles={roles}
          isFirst={idx === 0}
        />
      ))}

      <div className="flex-1" />

      {/* User block */}
      <UserBlock />
    </aside>
  );
}
