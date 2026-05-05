import type { NamespacePresetResponseDTO, NamespaceResponseDTO } from "@shared/backend-api";
import { Link } from "@tanstack/react-router";
import React from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Card, CardHeader, CardTitle } from "@/components/common/Card";
import { EmptyState } from "@/components/common/EmptyState";
import { useNamespacePresets, useSetPresetActive } from "@/features/namespaces/hooks/useNamespaces";

interface IRealPresetsTabProps {
  namespace: NamespaceResponseDTO;
}

/**
 * Groups preset rows by name and returns, for each name, all versions sorted
 * descending. The first element of each group is the latest version.
 */
function groupPresetsByName(
  presets: NamespacePresetResponseDTO[],
): Map<string, NamespacePresetResponseDTO[]> {
  const map = new Map<string, NamespacePresetResponseDTO[]>();
  for (const preset of presets) {
    const existing = map.get(preset.name);
    if (existing) {
      existing.push(preset);
    } else {
      map.set(preset.name, [preset]);
    }
  }
  // Sort each group descending by version
  for (const [, group] of map) {
    group.sort((a, b) => b.version - a.version);
  }
  return map;
}

function buildSummary(params: Record<string, unknown>): string {
  const width = typeof params["width"] === "number" ? params["width"] : undefined;
  const height = typeof params["height"] === "number" ? params["height"] : undefined;
  const format = typeof params["format"] === "string" ? params["format"] : "";
  const quality = typeof params["quality"] === "number" ? params["quality"] : undefined;

  const parts: string[] = [];
  if (width !== undefined && height !== undefined) {
    parts.push(`${width}×${height}`);
  } else if (width !== undefined) {
    parts.push(`${width}×—`);
  } else if (height !== undefined) {
    parts.push(`—×${height}`);
  }
  if (format) {
    parts.push(format);
  }
  if (quality !== undefined) {
    parts.push(`q${quality}`);
  }
  return parts.join(" ");
}

// Simple toggle switch using a button (no shadcn dependency required)
interface ISwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
}

function Switch({
  checked,
  onCheckedChange,
  disabled,
  "aria-label": ariaLabel,
}: ISwitchProps): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      aria-disabled={disabled}
      onClick={() => {
        if (!disabled) {
          onCheckedChange(!checked);
        }
      }}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
        disabled ? "cursor-not-allowed opacity-50" : ""
      } ${checked ? "bg-latam-indigo" : "bg-gray-200"}`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export function RealPresetsTab({ namespace }: IRealPresetsTabProps): React.JSX.Element {
  const { t } = useTranslation();
  const { data: presets = [], isLoading } = useNamespacePresets(namespace.slug);
  const setActive = useSetPresetActive();

  const isArchived = Boolean(namespace.archivedAt);
  const grouped = groupPresetsByName(presets);

  function onToggleActive(name: string, current: boolean): void {
    setActive.mutate({ slug: namespace.slug, name, input: { active: !current } });
  }

  if (isLoading) {
    return (
      <Card>
        <div className="px-6 py-8 text-center">
          <div className="text-muted-foreground text-[14px]">
            {t("pages.namespaceDetail.loading")}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Presets list */}
      {grouped.size === 0 ? (
        <EmptyState
          title={t("pages.namespaces.presets.empty")}
          description=""
          action={
            isArchived ? null : (
              <Button asChild variant="indigo">
                <Link to="/namespaces/$slug/presets/new" params={{ slug: namespace.slug }}>
                  {t("pages.namespaces.presets.newPreset")}
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <Card className="p-0">
          <CardHeader>
            <CardTitle>{t("pages.namespaces.presets.title")}</CardTitle>
          </CardHeader>
          <div>
            {[...grouped.entries()].map(([name, versions]) => {
              const latest = versions[0];
              if (!latest) return null;

              const summary = buildSummary(latest.params);

              return (
                <div
                  key={name}
                  className="border-border/40 flex items-center gap-4 border-b px-5 py-3 last:border-b-0"
                >
                  {/* Active toggle */}
                  <Switch
                    checked={latest.active}
                    disabled={isArchived}
                    aria-label={isArchived ? t("pages.namespaces.presets.archivedTooltip") : name}
                    onCheckedChange={() => {
                      onToggleActive(name, latest.active);
                    }}
                  />

                  {/* Name + summary */}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="font-mono text-[13px] font-semibold">{name}</span>
                    {summary ? (
                      <span className="text-muted-foreground font-mono text-[11px]">{summary}</span>
                    ) : null}
                  </div>

                  {/* Version chip */}
                  <Badge variant="muted">
                    {t("pages.namespaces.presets.version", { version: latest.version })}
                  </Badge>

                  {/* Active/Inactive badge */}
                  {latest.active ? (
                    <Badge variant="ok">{t("pages.namespaces.presets.active")}</Badge>
                  ) : (
                    <Badge variant="muted">{t("pages.namespaces.presets.inactive")}</Badge>
                  )}

                  {/* Edit link */}
                  <Link
                    to="/namespaces/$slug/presets/$name/edit"
                    params={{ slug: namespace.slug, name }}
                    className="text-muted-foreground hover:text-foreground text-[12px] underline-offset-2 hover:underline"
                  >
                    {t("pages.namespaces.presets.editPreset")}
                  </Link>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* New preset CTA (shown below list when presets exist) */}
      {grouped.size > 0 && (
        <div className="flex">
          {isArchived ? (
            <Button
              type="button"
              variant="outline"
              disabled
              aria-disabled="true"
              title={t("pages.namespaces.presets.archivedTooltip")}
            >
              {t("pages.namespaces.presets.newPreset")}
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link to="/namespaces/$slug/presets/new" params={{ slug: namespace.slug }}>
                {t("pages.namespaces.presets.newPreset")}
              </Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
