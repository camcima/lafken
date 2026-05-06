import type { NamespaceResponseDTO } from "@shared/backend-api";
import { Link } from "@tanstack/react-router";
import { Layers, Plus, Search } from "lucide-react";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { useNamespaces } from "@/features/namespaces/hooks/useNamespaces";

const ICON_MD = 13;
const ICON_LG = 18;
const ISO_DATE_LENGTH = 10;
const NAMESPACES_LIST_LIMIT = 50;

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().slice(0, ISO_DATE_LENGTH);
}

function NamespaceCard({ ns }: { ns: NamespaceResponseDTO }): React.JSX.Element {
  const { t } = useTranslation();
  const isArchived = ns.archivedAt !== null && ns.archivedAt !== undefined;

  return (
    <Card className="hover:border-latam-indigo/30 p-0 transition-all hover:shadow-md">
      <Link to="/namespaces/$slug" params={{ slug: ns.slug }} className="block w-full text-left">
        <div className="flex items-start gap-3 px-5 py-4">
          <div className="bg-latam-indigo/10 text-latam-indigo-deep grid size-10 flex-none place-items-center rounded">
            <Layers size={ICON_LG} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <h2 className="m-0 truncate text-[14px] font-semibold">{ns.displayName}</h2>
              <Badge variant="muted">
                {t("pages.namespaces.policyVersion", { version: ns.currentPolicyVersion })}
              </Badge>
              {isArchived ? (
                <Badge variant="muted">{t("pages.namespaces.archivedBadge")}</Badge>
              ) : null}
            </div>
            <div className="text-muted-foreground mt-0.5 font-mono text-[11.5px]">{ns.slug}</div>
            {ns.description ? (
              <div className="text-muted-foreground mt-1 truncate text-[12px]">
                {ns.description}
              </div>
            ) : null}
          </div>
        </div>

        <div className="border-border bg-secondary/30 text-muted-foreground grid gap-0.5 border-t px-5 py-2.5 font-mono text-[11.5px]">
          <span className="truncate">
            {t("pages.namespaces.policyVersion", { version: ns.currentPolicyVersion })} ·{" "}
            {ns.storageBindingName}
          </span>
          <span>{t("pages.namespaces.card.created", { date: formatDate(ns.createdAt) })}</span>
        </div>
      </Link>
    </Card>
  );
}

export function NamespacesListPage(): React.JSX.Element {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");

  const { data: page } = useNamespaces({ page: 1, limit: NAMESPACES_LIST_LIMIT });
  const namespaces: NamespaceResponseDTO[] = page?.data ?? [];

  const filtered = namespaces.filter(
    (ns) =>
      !query ||
      ns.slug.includes(query.toLowerCase()) ||
      ns.displayName.toLowerCase().includes(query.toLowerCase()),
  );

  const hasNamespaces = namespaces.length > 0;
  const hasFilteredResults = filtered.length > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-[22px] font-bold tracking-tight">
            {t("pages.namespaces.title")}
          </h1>
          <div className="text-muted-foreground mt-1 text-[12.5px]">
            {t("pages.namespaces.subtitle")}
          </div>
        </div>
        <Button asChild variant="indigo">
          <Link to="/namespaces/new">
            <Plus size={ICON_MD} />
            {t("pages.namespaces.actions.newNamespace")}
          </Link>
        </Button>
      </div>

      {/* Search */}
      <Card className="mb-4 p-3">
        <div className="relative">
          <Search
            size={ICON_MD}
            className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2"
          />
          <input
            type="search"
            placeholder={t("pages.namespaces.searchPlaceholder")}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
            className="border-input placeholder:text-muted-foreground focus:ring-latam-indigo/50 h-9 w-full rounded-md border bg-transparent pr-3 pl-9 text-[12.5px] outline-none focus:ring-1"
          />
        </div>
      </Card>

      {/* Card grid or empty state */}
      {hasFilteredResults ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filtered.map((ns) => (
            <NamespaceCard key={ns.slug} ns={ns} />
          ))}
        </div>
      ) : (
        <Card className="px-5 py-10 text-center">
          <div className="text-foreground text-[14px] font-medium">
            {hasNamespaces
              ? t("pages.namespaces.empty.noMatch.title")
              : t("pages.namespaces.empty.title")}
          </div>
          <div className="text-muted-foreground mt-1 text-[12.5px]">
            {hasNamespaces
              ? t("pages.namespaces.empty.noMatch.description")
              : t("pages.namespaces.empty.description")}
          </div>
          {!hasNamespaces ? (
            <div className="mt-4 flex justify-center">
              <Button asChild variant="indigo">
                <Link to="/namespaces/new">
                  <Plus size={ICON_MD} />
                  {t("pages.namespaces.actions.newNamespace")}
                </Link>
              </Button>
            </div>
          ) : null}
        </Card>
      )}
    </div>
  );
}
