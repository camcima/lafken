// apps/web/src/lib/demo/lafken-notifications.ts
//
// Demo notification data used by the NotificationsPanel while the backend
// returns empty arrays.  Replace with live API responses as the BE matures.

export type NotificationCategory = "review" | "system" | "workspace";
export type NotificationSeverity = "alert" | "warn" | "info";

export interface IDemoNotification {
  id: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  body: string;
  /** TanStack Router-friendly path */
  href: string;
  minutesAgo: number;
  unread: boolean;
}

export const NOTIFICATION_CATEGORY_DEF: Record<
  NotificationCategory,
  { labelKey: string; icon: string }
> = {
  review: { labelKey: "notifications.categories.review", icon: "Shield" },
  system: { labelKey: "notifications.categories.system", icon: "Server" },
  workspace: {
    labelKey: "notifications.categories.workspace",
    icon: "Layers",
  },
};

const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
/** n_08 was flagged 18 hours ago in the demo data set */
const N_08_HOURS_AGO = 18;

/** Returns "now" when minutes < 1, otherwise a human-readable age string. */
export function fmtAgoWithNow(minutes: number): string {
  if (minutes < 1) return "now";
  if (minutes < MINUTES_PER_HOUR) return `${minutes}m ago`;
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  if (hours < HOURS_PER_DAY) return `${hours}h ago`;
  return `${Math.floor(hours / HOURS_PER_DAY)}d ago`;
}

export const DEMO_NOTIFICATIONS: IDemoNotification[] = [
  {
    id: "n_01",
    category: "system",
    severity: "alert",
    title: "Transform stage degraded",
    body: "p95 has been above 1.50s for 14 minutes. Queue depth 4,811 and growing.",
    href: "/system",
    minutesAgo: 4,
    unread: true,
  },
  {
    id: "n_02",
    category: "review",
    severity: "info",
    title: "5 quarantined assets > 24h old",
    body: "Reviewer SLO is 4h. Oldest is 36h (cargo-damage / violence 0.78).",
    href: "/quarantine",
    minutesAgo: 18,
    unread: true,
  },
  {
    id: "n_03",
    category: "workspace",
    severity: "warn",
    title: "Legal hold placed on aircraft-photos",
    body: "lh_01HX7 · placed by a.bravo@latam.com · case CHL-2025-AVN-077",
    href: "/legal-holds",
    minutesAgo: 49,
    unread: true,
  },
  {
    id: "n_04",
    category: "review",
    severity: "info",
    title: "Your review was overridden",
    body: "01HXJ002KQZ · released by p.estrada@latam.com after your reject decision.",
    href: "/audit",
    minutesAgo: 92,
    unread: false,
  },
  {
    id: "n_05",
    category: "system",
    severity: "alert",
    title: "Worker processor-12 unreachable",
    body: "Last seen 3m ago · Memphis pool · auto-restart attempt 2/3.",
    href: "/system",
    minutesAgo: 130,
    unread: false,
  },
  {
    id: "n_06",
    category: "workspace",
    severity: "info",
    title: "Policy v8 published for ground-ops-incidents",
    body: "Retention 10y → 12y. New required field: incident_severity. Effective immediately.",
    href: "/namespaces",
    minutesAgo: 240,
    unread: false,
  },
  {
    id: "n_07",
    category: "workspace",
    severity: "info",
    title: "API key rotated · cargo-ingest-svc",
    body: "Rotated by m.fernandez@latam.com. Previous key deactivates in 24h.",
    href: "/settings",
    minutesAgo: 320,
    unread: false,
  },
  {
    id: "n_08",
    category: "review",
    severity: "warn",
    title: "Escalation: medical category match",
    body: "01HXJ003UWQZ · score 0.72 (threshold 0.65) · awaiting reviewer with medical clearance.",
    href: "/quarantine",
    minutesAgo: N_08_HOURS_AGO * MINUTES_PER_HOUR,
    unread: false,
  },
];
