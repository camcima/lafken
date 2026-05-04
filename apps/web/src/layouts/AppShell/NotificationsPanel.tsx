import { Link } from "@tanstack/react-router";
import { Bell, Check, Info, Layers, Server, Settings, Shield, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/common/Badge/Badge";
import {
  DEMO_NOTIFICATIONS,
  fmtAgoWithNow,
  type IDemoNotification,
  NOTIFICATION_CATEGORY_DEF,
  type NotificationCategory,
} from "@/lib/demo/lafken-notifications";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Shield,
  Server,
  Layers,
  Info,
  Check,
};

const SEVERITY_TONE: Record<
  IDemoNotification["severity"],
  { dot: string; text: string; soft: string; line: string }
> = {
  alert: {
    dot: "bg-alert",
    text: "text-alert",
    soft: "bg-alert-soft",
    line: "border-alert-line",
  },
  warn: {
    dot: "bg-warn",
    text: "text-warn",
    soft: "bg-warn-soft",
    line: "border-warn-line",
  },
  info: {
    dot: "bg-latam-indigo",
    text: "text-latam-indigo",
    soft: "bg-latam-indigo/10",
    line: "border-latam-indigo/20",
  },
};

type FilterTab = "all" | "unread" | NotificationCategory;

interface INotificationsPanelProps {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}

export function NotificationsPanel({
  open,
  onClose,
  anchorRef,
}: INotificationsPanelProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<FilterTab>("all");
  const [readMap, setReadMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(DEMO_NOTIFICATIONS.map((notif) => [notif.id, !notif.unread])),
  );
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onClick = (e: MouseEvent): void => {
      if (panelRef.current?.contains(e.target as Node)) return;
      if (anchorRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  const list = DEMO_NOTIFICATIONS.filter((notif) => {
    if (filter === "all") return true;
    if (filter === "unread") return !readMap[notif.id];
    return notif.category === filter;
  });

  const unreadCount = DEMO_NOTIFICATIONS.filter((notif) => !readMap[notif.id]).length;

  const markAllRead = (): void => {
    setReadMap(Object.fromEntries(DEMO_NOTIFICATIONS.map((notif) => [notif.id, true])));
  };

  const markRead = (id: string): void => {
    setReadMap((prev) => ({ ...prev, [id]: true }));
  };

  const tabs: { id: FilterTab; labelKey: string; count: number }[] = [
    {
      id: "all",
      labelKey: "notifications.tabs.all",
      count: DEMO_NOTIFICATIONS.length,
    },
    {
      id: "unread",
      labelKey: "notifications.tabs.unread",
      count: unreadCount,
    },
    {
      id: "review",
      labelKey: "notifications.tabs.review",
      count: DEMO_NOTIFICATIONS.filter((notif) => notif.category === "review").length,
    },
    {
      id: "system",
      labelKey: "notifications.tabs.system",
      count: DEMO_NOTIFICATIONS.filter((notif) => notif.category === "system").length,
    },
    {
      id: "workspace",
      labelKey: "notifications.tabs.workspace",
      count: DEMO_NOTIFICATIONS.filter((notif) => notif.category === "workspace").length,
    },
  ];

  return (
    <div
      ref={panelRef}
      className="border-border bg-card absolute top-12 right-3 z-50 w-[420px] overflow-hidden rounded-lg border shadow-2xl"
      style={{
        boxShadow: "0 20px 60px rgba(15,23,42,0.18), 0 4px 12px rgba(15,23,42,0.06)",
      }}
    >
      {/* Header */}
      <div className="border-border bg-secondary/30 flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-foreground text-[13.5px] font-semibold tracking-tight">
            {t("notifications.title")}
          </span>
          {unreadCount > 0 && (
            <Badge variant="indigo" className="px-1.5 py-0 text-[10.5px]">
              {t("notifications.newCountBadge", { count: unreadCount })}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={markAllRead}
            disabled={unreadCount === 0}
            className="text-muted-foreground hover:bg-secondary hover:text-foreground disabled:hover:text-muted-foreground rounded px-2 py-1 text-[11.5px] disabled:opacity-40 disabled:hover:bg-transparent"
          >
            {t("notifications.markAllRead")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:bg-secondary hover:text-foreground grid size-6 place-items-center rounded"
            aria-label={t("notifications.close")}
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="border-border flex items-center gap-0.5 border-b px-2 py-1.5">
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.id}
            onClick={() => {
              setFilter(tab.id);
            }}
            className={cn(
              "inline-flex items-center gap-1 rounded px-2 py-1 text-[11.5px] transition-colors",
              filter === tab.id
                ? "bg-latam-indigo text-white"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            {t(tab.labelKey)}
            {tab.count > 0 && (
              <span
                className={cn(
                  "rounded-full px-1 font-mono text-[10px] tabular-nums",
                  filter === tab.id
                    ? "bg-white/25 text-white"
                    : "bg-secondary text-muted-foreground",
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="max-h-[460px] overflow-y-auto">
        {list.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <div className="bg-secondary text-muted-foreground mx-auto mb-3 grid size-10 place-items-center rounded-full">
              <Bell size={16} />
            </div>
            <div className="text-[13px] font-medium">{t("notifications.empty.title")}</div>
            <div className="text-muted-foreground mt-1 text-[11.5px]">
              {t("notifications.empty.subtitle")}
            </div>
          </div>
        ) : (
          <ul className="divide-border/60 divide-y">
            {list.map((notif) => {
              const tone = SEVERITY_TONE[notif.severity];
              const unread = !readMap[notif.id];
              const catDef = NOTIFICATION_CATEGORY_DEF[notif.category];
              const CatIcon = ICON_MAP[catDef.icon] ?? Info;
              return (
                <li
                  key={notif.id}
                  className={cn("group relative", unread && "bg-latam-indigo/[0.025]")}
                >
                  <Link
                    to={notif.href as "/"}
                    onClick={() => {
                      markRead(notif.id);
                    }}
                    className="hover:bg-secondary/50 grid grid-cols-[24px_1fr_auto] items-start gap-3 px-4 py-3 no-underline transition-colors"
                  >
                    {/* icon column */}
                    <div
                      className={cn(
                        "mt-0.5 grid size-6 place-items-center rounded-md",
                        tone.soft,
                        tone.text,
                      )}
                    >
                      <CatIcon size={12} />
                    </div>
                    {/* content */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "truncate text-[12.5px]",
                            unread
                              ? "text-foreground font-semibold"
                              : "text-foreground/90 font-medium",
                          )}
                        >
                          {t(`notifications.items.${notif.id}.title`)}
                        </span>
                      </div>
                      <div className="text-muted-foreground mt-0.5 line-clamp-2 text-[11.5px] leading-snug">
                        {t(`notifications.items.${notif.id}.body`)}
                      </div>
                      <div className="text-muted-foreground mt-1.5 flex items-center gap-2 text-[10.5px]">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded px-1.5 py-px font-medium tracking-wider uppercase",
                            tone.soft,
                            tone.text,
                          )}
                        >
                          {t(catDef.labelKey)}
                        </span>
                        <span className="font-mono tabular-nums">
                          {fmtAgoWithNow(notif.minutesAgo)}
                        </span>
                      </div>
                    </div>
                    {/* unread dot */}
                    <div className="flex h-full items-start pt-1">
                      {unread ? (
                        <span
                          className="bg-latam-pink size-2 rounded-full"
                          title={t("notifications.tabs.unread")}
                        />
                      ) : (
                        <span className="size-2" />
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="border-border bg-secondary/30 flex items-center justify-between border-t px-4 py-2">
        <Link to="/audit" className="text-muted-foreground hover:text-latam-indigo text-[11.5px]">
          {t("notifications.footer.viewAll")}
        </Link>
        <Link
          to="/settings"
          className="text-muted-foreground hover:text-latam-indigo inline-flex items-center gap-1 text-[11.5px]"
        >
          <Settings size={11} />
          {t("notifications.footer.settings")}
        </Link>
      </div>
    </div>
  );
}
