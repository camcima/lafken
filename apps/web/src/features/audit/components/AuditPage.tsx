import type { AuditEntryResponseDTO } from "@shared/backend-api";
import { useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import {
  Check,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Info,
  Layers,
  Lock,
  Search,
  Settings,
  Shield,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { Paginator } from "@/components/common/Paginator";
import { RightDrawer } from "@/components/common/RightDrawer";
import { SELECT_CLASS, SELECT_CLASS_SM } from "@/components/common/select-styles";
import { ListQueryError } from "@/components/feedback/Error/ListQueryError";
import { useAuditEntries } from "@/features/audit/hooks/useAudit";
import { cn } from "@/lib/utils";
import { AUDIT_ENTITY_TYPES } from "@/routes/_protected/audit";

type AuditResult = "ok" | "fail";

const MIN_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

function fmtMinAgo(minutes: number): string {
  if (minutes < MIN_PER_HOUR) return `${minutes}m`;
  const hours = Math.floor(minutes / MIN_PER_HOUR);
  if (hours < HOURS_PER_DAY) return `${hours}h`;
  const days = Math.floor(hours / HOURS_PER_DAY);
  return `${days}d`;
}

const AUDIT_RETENTION = "10y";

const TYPE_ICON_DEFAULT_SIZE = 12;
const TYPE_ICON_DRAWER_SIZE = 14;
const CHEVRON_SIZE = 12;
const BTN_ICON_SIZE = 13;
const COPY_ICON_SIZE = 11;

const MS_PER_MINUTE = 60_000;

const TABLE_COLS =
  "grid-cols-[110px_minmax(0,1.4fr)_minmax(0,1.6fr)_minmax(0,1.4fr)_120px_70px_34px]";

interface IAuditRow {
  id: string;
  type: string;
  actor: string;
  target: string;
  namespace: string;
  ip: string;
  minutesAgo: number;
  result: AuditResult;
  payload?: Pick<
    AuditEntryResponseDTO,
    | "beforeState"
    | "afterState"
    | "reason"
    | "requestIp"
    | "occurredAt"
    | "entityType"
    | "entityId"
    | "action"
  >;
}

function apiToRow(entry: AuditEntryResponseDTO): IAuditRow {
  const occurredAtMs = Date.parse(entry.occurredAt);
  const minutesAgo = Number.isFinite(occurredAtMs)
    ? Math.max(0, Math.floor((Date.now() - occurredAtMs) / MS_PER_MINUTE))
    : 0;
  const afterStateNamespace =
    typeof entry.afterState?.namespace === "string" ? entry.afterState.namespace : "";
  const namespace =
    entry.entityType === "namespace_preset" && entry.entityId.includes("/")
      ? (entry.entityId.split("/")[0] ?? "")
      : entry.entityType === "namespace" || entry.entityType === "namespace_policy"
        ? entry.entityId
        : entry.entityType === "asset"
          ? afterStateNamespace
          : "";
  return {
    id: entry.id,
    type: `${entry.entityType}.${entry.action}`,
    actor: entry.occurredBy,
    target: entry.entityId,
    namespace,
    ip: entry.requestIp ?? "—",
    minutesAgo,
    result: "ok",
    payload: {
      beforeState: entry.beforeState,
      afterState: entry.afterState,
      reason: entry.reason,
      requestIp: entry.requestIp,
      occurredAt: entry.occurredAt,
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
    },
  };
}

type ITypeIconProps = {
  type: string;
  size?: number;
};

function TypeIcon({ type, size = TYPE_ICON_DEFAULT_SIZE }: ITypeIconProps): React.JSX.Element {
  const cls = `flex-none`;
  if (type.startsWith("legal_hold")) return <Lock size={size} className={cn(cls, "text-warn")} />;
  if (type.includes("quarantined")) return <Shield size={size} className={cn(cls, "text-alert")} />;
  if (type.includes("ready") || type.includes("approved"))
    return <Check size={size} className={cn(cls, "text-ok")} />;
  if (type.includes("failed") || type.includes("rejected"))
    return <X size={size} className={cn(cls, "text-danger")} />;
  if (type.includes("policy") || type.includes("namespace"))
    return <Layers size={size} className={cn(cls, "text-latam-indigo")} />;
  if (type.includes("storage_binding"))
    return <Settings size={size} className={cn(cls, "text-latam-indigo")} />;
  if (type.includes("api_key") || type.includes("user"))
    return <Settings size={size} className={cn(cls, "text-latam-indigo")} />;
  if (type.includes("export"))
    return <Download size={size} className={cn(cls, "text-latam-indigo")} />;
  return <Info size={size} className={cn(cls, "text-muted-foreground")} />;
}

interface IAuditDrawerProps {
  entry: IAuditRow;
  onClose: () => void;
}

function AuditDrawer({ entry, onClose }: IAuditDrawerProps): React.JSX.Element {
  const { t } = useTranslation();

  const jsonText: string = JSON.stringify(
    {
      event_id: entry.id,
      type: entry.type,
      entity_type: entry.payload?.entityType ?? null,
      entity_id: entry.payload?.entityId ?? null,
      action: entry.payload?.action ?? null,
      occurred_at: entry.payload?.occurredAt ?? null,
      occurred_by: entry.actor,
      request_ip: entry.payload?.requestIp ?? null,
      before_state: entry.payload?.beforeState ?? null,
      after_state: entry.payload?.afterState ?? null,
      reason: entry.payload?.reason ?? null,
    },
    null,
    2,
  );

  return (
    <RightDrawer
      open
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <TypeIcon type={entry.type} size={TYPE_ICON_DRAWER_SIZE} />
          <span>{entry.type}</span>
        </div>
      }
    >
      <div className="px-5 py-5">
        <div className="border-border bg-secondary/30 rounded border p-3 font-mono text-[11px] leading-relaxed whitespace-pre">
          {jsonText}
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="outline" size="sm">
            <Copy size={COPY_ICON_SIZE} />
            {t("pages.audit.drawer.copyJson")}
          </Button>
          <Button variant="outline" size="sm">
            <ExternalLink size={COPY_ICON_SIZE} />
            {t("pages.audit.drawer.openTarget")}
          </Button>
        </div>
      </div>
    </RightDrawer>
  );
}

/* eslint-disable no-magic-numbers */
const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 50;
/* eslint-enable no-magic-numbers */

const TYPE_FILTER_TO_ENTITY_TYPE: Record<string, string | undefined> = {
  namespace: "namespace",
  namespace_policy: "namespace_policy",
  namespace_preset: "namespace_preset",
  storage_binding: "storage_binding",
  legal_hold: "legal_hold",
  asset: "asset",
};

const SEARCH_DEBOUNCE_MS = 250;

export function AuditPage(): React.JSX.Element {
  const { t } = useTranslation();
  const { q, type, page } = useSearch({ from: "/_protected/audit" });
  const navigate = useNavigate();
  const router = useRouter();

  // `pendingQuery` is the user's not-yet-committed edit: null except while a
  // debounce write is in flight. The displayed `query` derives from it (or
  // falls back to the URL's `q`) instead of mirroring `q` into its own state,
  // so external navigation is reflected for free on the next render — no
  // resync effect required, and nothing to fight the debounce write below.
  const [pendingQuery, setPendingQuery] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const query: string = pendingQuery ?? q ?? "";
  const pageIndex: number = page - 1;
  const typeFilter: string = type ?? "all";
  const beEntityType: string | undefined = TYPE_FILTER_TO_ENTITY_TYPE[typeFilter];

  // History navigation (Back/Forward) always wins over an edit the user never
  // committed: discard the pending edit, which both disarms the debounce below
  // (its cleanup cancels the armed timer) and drops the input back to the URL's
  // `q`. Without this, a timer armed by the last keystroke survives the Back —
  // no dependency of the effect below changed — and fires with its stale
  // closure value, rewriting the URL and undoing the navigation.
  //
  // This path may only ever CANCEL, never write `q`. That is the invariant: an
  // effect that WRITES in response to an external `q` change is what let the
  // URL resurrect a stale search in the first place. Clearing state in a
  // subscription callback (rather than synchronously in an effect body) is also
  // exactly the pattern `react-hooks/set-state-in-effect` prescribes.
  useEffect(() => {
    return router.history.subscribe(({ action }) => {
      if (action.type === "PUSH" || action.type === "REPLACE") return;
      setPendingQuery(null);
    });
  }, [router]);

  // Debounce the free-text input into the URL (replace, so Back skips
  // keystrokes). Only armed while there is a pending edit.
  useEffect(() => {
    if (pendingQuery === null) return;
    const handle = window.setTimeout(() => {
      const trimmed = pendingQuery.trim();
      void navigate({
        to: "/audit",
        search: (prev) => ({ ...prev, q: trimmed === "" ? undefined : trimmed, page: 1 }),
        replace: true,
      });
      setPendingQuery(null);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(handle);
    };
  }, [pendingQuery, navigate]);

  const realQuery = useAuditEntries({
    page,
    limit: pageSize,
    ...(beEntityType ? { entityType: beEntityType } : {}),
    ...(q?.trim() ? { q: q.trim() } : {}),
  });

  const allRows: IAuditRow[] = (realQuery.data?.data ?? []).map(apiToRow);

  const realTotal: number = realQuery.data?.total ?? 0;
  const totalPages: number = Math.max(1, Math.ceil(realTotal / pageSize));
  const pageRows: IAuditRow[] = allRows;

  const openEntry: IAuditRow | undefined = allRows.find((entry) => entry.id === openId);

  const visibleTotal: number = realTotal;
  const rangeFrom = visibleTotal === 0 ? 0 : pageIndex * pageSize + 1;
  const rangeTo = Math.min((pageIndex + 1) * pageSize, realTotal);

  const anchorMinutesAgo: number = allRows[0]?.minutesAgo ?? 0;

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h1 className="m-0 text-[22px] font-bold tracking-tight">{t("pages.audit.title")}</h1>
        <div className="text-muted-foreground mt-1 text-[12.5px]">
          {t("pages.audit.subtitle", {
            retention: AUDIT_RETENTION,
            anchor: fmtMinAgo(anchorMinutesAgo),
          })}
        </div>
      </div>

      <Card className="mb-4 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[260px] flex-1">
            <Search
              size={BTN_ICON_SIZE}
              className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2"
            />
            <input
              type="text"
              placeholder={t("pages.audit.searchPlaceholder")}
              value={query}
              onChange={(ev: React.ChangeEvent<HTMLInputElement>) => {
                setPendingQuery(ev.target.value);
              }}
              aria-label={t("pages.audit.searchLabel")}
              className="border-input bg-card focus:ring-ring h-9 w-full rounded-md border pr-3 pl-9 text-[12.5px] outline-none focus:ring-1"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(ev: React.ChangeEvent<HTMLSelectElement>) => {
              const value = ev.target.value;
              void navigate({
                to: "/audit",
                search: (prev) => ({
                  ...prev,
                  type:
                    value === "all" ? undefined : (value as (typeof AUDIT_ENTITY_TYPES)[number]),
                  page: 1,
                }),
              });
            }}
            aria-label={t("pages.audit.filters.typeLabel")}
            className={SELECT_CLASS}
          >
            <option value="all">{t("pages.audit.filters.allTypes")}</option>
            <option value="asset">asset.*</option>
            <option value="namespace">namespace.*</option>
            <option value="namespace_policy">namespace_policy.*</option>
            <option value="namespace_preset">namespace_preset.*</option>
            <option value="storage_binding">storage_binding.*</option>
            <option value="legal_hold">legal_hold.*</option>
          </select>
        </div>
      </Card>

      {realQuery.isError ? (
        <ListQueryError
          isRetrying={realQuery.isFetching}
          onRetry={() => {
            void realQuery.refetch();
          }}
        />
      ) : (
        <Card className="overflow-x-auto">
          <div className="min-w-[920px]">
            <div
              className={cn(
                "border-border bg-secondary/40 text-muted-foreground grid items-center gap-3 border-b px-4 py-2 text-[10.5px] font-medium tracking-wider uppercase",
                TABLE_COLS,
              )}
            >
              <span>{t("pages.audit.table.time")}</span>
              <span>{t("pages.audit.table.type")}</span>
              <span>{t("pages.audit.table.actor")}</span>
              <span>{t("pages.audit.table.target")}</span>
              <span>{t("pages.audit.table.ip")}</span>
              <span>{t("pages.audit.table.result")}</span>
              <span />
            </div>
            {pageRows.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => {
                  setOpenId(entry.id);
                }}
                className={cn(
                  "border-border/40 hover:bg-secondary/30 grid w-full items-center gap-3 border-b px-4 py-2 text-left text-[12px] last:border-b-0",
                  TABLE_COLS,
                )}
              >
                <div className="text-muted-foreground font-mono text-[11px] tabular-nums">
                  {fmtMinAgo(entry.minutesAgo)}
                </div>
                <div className="inline-flex min-w-0 items-center gap-1.5">
                  <TypeIcon type={entry.type} />
                  <span className="truncate font-mono text-[11.5px]">{entry.type}</span>
                </div>
                <div className="text-muted-foreground truncate font-mono text-[11.5px]">
                  {entry.actor}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-mono text-[11.5px]">{entry.target}</div>
                  <div className="text-muted-foreground truncate font-mono text-[10.5px]">
                    {entry.namespace}
                  </div>
                </div>
                <div className="text-muted-foreground font-mono text-[10.5px] tabular-nums">
                  {entry.ip}
                </div>
                <div>
                  {entry.result === "ok" ? (
                    <Badge variant="ok">
                      <span className="bg-ok size-1 rounded-full" />
                      {t("pages.audit.result.ok")}
                    </Badge>
                  ) : (
                    <Badge variant="danger">
                      <span className="bg-danger size-1 rounded-full" />
                      {t("pages.audit.result.fail")}
                    </Badge>
                  )}
                </div>
                <ChevronRight size={CHEVRON_SIZE} className="text-muted-foreground" />
              </button>
            ))}
          </div>
        </Card>
      )}

      <div className="text-muted-foreground mt-3 flex flex-wrap items-center justify-between gap-3 text-[11.5px]">
        <div className="flex items-center gap-2">
          <span>{t("paginator.rowsPerPage")}</span>
          <select
            value={pageSize}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
              setPageSize(Number(e.target.value));
              void navigate({ to: "/audit", search: (prev) => ({ ...prev, page: 1 }) });
            }}
            className={SELECT_CLASS_SM}
            aria-label={t("paginator.rowsPerPage")}
          >
            {PAGE_SIZE_OPTIONS.map((pageOpt) => (
              <option key={pageOpt} value={pageOpt}>
                {pageOpt}
              </option>
            ))}
          </select>
          {visibleTotal > 0 && (
            <>
              <span className="hidden sm:inline">·</span>
              <span className="hidden font-mono tabular-nums sm:inline">
                {t("paginator.range", {
                  from: rangeFrom.toLocaleString(),
                  to: rangeTo.toLocaleString(),
                  total: visibleTotal.toLocaleString(),
                })}
              </span>
            </>
          )}
        </div>
        <Paginator
          page={pageIndex}
          totalPages={totalPages}
          onChange={(newPage) => {
            void navigate({ to: "/audit", search: (prev) => ({ ...prev, page: newPage + 1 }) });
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      </div>

      {openEntry !== undefined && (
        <AuditDrawer
          entry={openEntry}
          onClose={() => {
            setOpenId(null);
          }}
        />
      )}
    </div>
  );
}
