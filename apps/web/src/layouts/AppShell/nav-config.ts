import type { LucideIcon } from "lucide-react";
import {
  ClipboardList,
  Database,
  Folder,
  Home,
  Image,
  Lock,
  Settings,
  ShieldAlert,
} from "lucide-react";

export type NavGroupId = "workspace" | "review" | "platform";

export interface INavLink {
  id: string;
  to: string;
  labelKey: string;
  icon: LucideIcon;
  countKey?: "quarantine" | "legalHolds" | "assets" | "namespaces";
  requiredRoles?: string[];
}

export interface INavGroup {
  id: NavGroupId;
  headingKey: string;
  links: INavLink[];
}

export const NAV_GROUPS: INavGroup[] = [
  {
    id: "workspace",
    headingKey: "nav.groups.workspace",
    links: [
      { id: "home", to: "/", labelKey: "nav.home", icon: Home },
      { id: "assets", to: "/assets", labelKey: "nav.assets", icon: Image, countKey: "assets" },
      {
        id: "namespaces",
        to: "/namespaces",
        labelKey: "nav.namespaces",
        icon: Folder,
        countKey: "namespaces",
      },
    ],
  },
  {
    id: "review",
    headingKey: "nav.groups.review",
    links: [
      {
        id: "quarantine",
        to: "/quarantine",
        labelKey: "nav.quarantine",
        icon: ShieldAlert,
        countKey: "quarantine",
        requiredRoles: ["content_reviewer", "platform_operator"],
      },
      {
        id: "legal-holds",
        to: "/legal-holds",
        labelKey: "nav.legalHolds",
        icon: Lock,
        countKey: "legalHolds",
        requiredRoles: ["content_reviewer", "platform_operator"],
      },
      {
        id: "audit",
        to: "/audit",
        labelKey: "nav.audit",
        icon: ClipboardList,
        requiredRoles: ["content_reviewer", "platform_operator"],
      },
    ],
  },
  {
    id: "platform",
    headingKey: "nav.groups.platform",
    links: [
      {
        id: "system",
        to: "/system",
        labelKey: "nav.system",
        icon: Database,
        requiredRoles: ["platform_operator"],
      },
      {
        id: "settings",
        to: "/settings",
        labelKey: "nav.settings",
        icon: Settings,
      },
    ],
  },
];
