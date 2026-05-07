import type { AssetResponseDTO } from "@shared/backend-api";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Plus, Search, X } from "lucide-react";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { useAssets } from "@/features/assets/hooks/useAssets";
import { usePlaceLegalHold } from "@/features/legal-holds/hooks/useLegalHoldMutations";
import { useNamespaces } from "@/features/namespaces/hooks/useNamespaces";
import { isDemoMode } from "@/lib/demo/demo-mode";
import { cn } from "@/lib/utils";

// ── Constants ──────────────────────────────────────────────
const CASE_REF_MIN = 3;
const CASE_REF_MAX = 100;
const DESCRIPTION_MIN = 10;
const DESCRIPTION_MAX = 1000;
const PAGE_SIZE = 25;
const NAMESPACE_LIMIT = 100;

// ── Sub-components ─────────────────────────────────────────
function FieldLabel(
  props: Readonly<
    Omit<React.LabelHTMLAttributes<HTMLLabelElement>, "htmlFor"> & { htmlFor: string }
  >,
): React.JSX.Element {
  const { className, ...rest } = props;
  return (
    <label // eslint-disable-line jsx-a11y/label-has-associated-control
      className={cn("text-foreground text-[11.5px] font-medium", className)}
      {...rest}
    />
  );
}

function TextInput(
  props: Readonly<React.InputHTMLAttributes<HTMLInputElement>>,
): React.JSX.Element {
  const { className, ...rest } = props;
  return (
    <input
      className={cn(
        "border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm",
        "ring-offset-background placeholder:text-muted-foreground",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...rest}
    />
  );
}

function TextArea(
  props: Readonly<React.TextareaHTMLAttributes<HTMLTextAreaElement>>,
): React.JSX.Element {
  const { className, ...rest } = props;
  return (
    <textarea
      className={cn(
        "border-input bg-background flex w-full rounded-md border px-3 py-2 text-sm",
        "ring-offset-background placeholder:text-muted-foreground",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...rest}
    />
  );
}

interface INumberedSectionProps {
  num: number;
  title: string;
  children: React.ReactNode;
  labelledBy: string;
}

function NumberedSection(props: Readonly<INumberedSectionProps>): React.JSX.Element {
  const { num, title, labelledBy, children } = props;
  const numStr = String(num).padStart(2, "0");
  return (
    <Card className="p-0" aria-labelledby={labelledBy}>
      <div className="border-border/60 flex items-baseline gap-3 border-b px-6 py-4">
        <span className="text-latam-pink font-mono text-[11px] tabular-nums">{numStr}</span>
        <h2
          id={labelledBy}
          className="text-foreground m-0 text-[14px] font-semibold tracking-tight"
        >
          {title}
        </h2>
      </div>
      <div className="space-y-4 px-6 py-5">{children}</div>
    </Card>
  );
}

// ── Main component ─────────────────────────────────────────
export function PlaceLegalHoldPage(): React.JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const placeMutation = usePlaceLegalHold();

  // Form state
  const [caseReference, setCaseReference] = useState("");
  const [description, setDescription] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);

  // Picker state
  const [namespaceSlug, setNamespaceSlug] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [picked, setPicked] = useState(new Set<string>());

  const namespacesQuery = useNamespaces({ limit: NAMESPACE_LIMIT });
  const namespaces = namespacesQuery.data?.data ?? [];

  const assetsQuery = useAssets({
    namespaceSlug: namespaceSlug !== "" ? namespaceSlug : undefined,
    q: searchQuery !== "" ? searchQuery : undefined,
    page: 1,
    limit: PAGE_SIZE,
  });
  const assets: AssetResponseDTO[] = assetsQuery.data?.data ?? [];

  // ── Basket helpers ─────────────────────────────────────────
  function togglePicked(publicId: string): void {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(publicId)) {
        next.delete(publicId);
      } else {
        next.add(publicId);
      }
      return next;
    });
  }

  function addAllVisible(): void {
    setPicked((prev) => {
      const next = new Set(prev);
      for (const asset of assets) {
        next.add(asset.publicId);
      }
      return next;
    });
  }

  function clearAll(): void {
    setPicked(new Set());
  }

  // ── Submit gating ──────────────────────────────────────────
  const canSubmit =
    caseReference.length >= CASE_REF_MIN &&
    caseReference.length <= CASE_REF_MAX &&
    description.length >= DESCRIPTION_MIN &&
    description.length <= DESCRIPTION_MAX &&
    picked.size >= 1 &&
    acknowledged &&
    !placeMutation.isPending;

  function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>): void {
    e.preventDefault();

    if (isDemoMode) {
      toast.info(t("pages.placeLegalHold.toast.demo"));
      return;
    }

    placeMutation.mutate(
      { caseReference, description, assetIds: [...picked] },
      {
        onSuccess: () => {
          toast.success(t("pages.placeLegalHold.toast.success", { caseReference }));
          void navigate({ to: "/legal-holds" });
        },
        onError: (err) => {
          toast.error(
            t("pages.placeLegalHold.toast.failure", {
              error: err instanceof Error ? err.message : String(err),
            }),
          );
        },
      },
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      {/* ── Header ─────────────────────────────────────── */}
      <div>
        <Link
          to="/legal-holds"
          className="text-muted-foreground mb-2 inline-flex items-center gap-1 text-[12px] hover:underline"
        >
          <ArrowLeft size={12} />
          {t("pages.placeLegalHold.back")}
        </Link>
        <h1 className="text-[22px] font-bold tracking-tight">{t("pages.placeLegalHold.title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("pages.placeLegalHold.subtitle")}</p>
      </div>

      <form id="place-legal-hold-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* ── Section 1: Case ──────────────────────────── */}
        <NumberedSection
          num={1}
          labelledBy="section-case"
          title={t("pages.placeLegalHold.sections.case")}
        >
          <div className="grid gap-2">
            <FieldLabel htmlFor="plh-case-reference">
              {t("pages.placeLegalHold.fields.caseReference")}
            </FieldLabel>
            <TextInput
              id="plh-case-reference"
              value={caseReference}
              onChange={(e) => {
                setCaseReference(e.target.value);
              }}
              maxLength={CASE_REF_MAX}
              placeholder="CHL-AVN-2026-014"
            />
            <p className="text-muted-foreground mt-1 text-[11px]">
              {t("pages.placeLegalHold.fields.caseReferenceHint")}
            </p>
          </div>
        </NumberedSection>

        {/* ── Section 2: Picker ────────────────────────── */}
        <NumberedSection
          num={2}
          labelledBy="section-picker"
          title={t("pages.placeLegalHold.sections.picker")}
        >
          {/* Namespace + search controls */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={namespaceSlug}
              onChange={(e) => {
                setNamespaceSlug(e.target.value);
              }}
              className="border-input bg-background h-9 rounded-md border px-3 py-1 text-sm focus:outline-none"
              aria-label={t("pages.placeLegalHold.fields.namespace")}
            >
              <option value="">{t("pages.placeLegalHold.fields.namespace")}</option>
              {namespaces.map((ns) => (
                <option key={ns.slug} value={ns.slug}>
                  {ns.displayName ?? ns.slug}
                </option>
              ))}
            </select>

            <div className="relative flex-1">
              <Search
                size={13}
                className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                }}
                placeholder={t("pages.placeLegalHold.fields.searchPlaceholder")}
                className="border-input bg-background h-9 w-full rounded-md border pr-3 pl-9 text-sm focus:outline-none"
                aria-label={t("pages.placeLegalHold.fields.search")}
              />
            </div>

            <Button type="button" variant="outline" size="sm" onClick={addAllVisible}>
              <Plus size={12} />
              {t("pages.placeLegalHold.picker.addAllVisible")}
            </Button>
          </div>

          {/* Results table */}
          <div className="border-border rounded-md border">
            {assets.length === 0 ? (
              <div className="text-muted-foreground px-4 py-6 text-center text-[12.5px]">
                {t("pages.placeLegalHold.picker.basketEmpty")}
              </div>
            ) : (
              <table className="w-full text-[12.5px]">
                <tbody>
                  {assets.map((asset) => {
                    const isPicked = picked.has(asset.publicId);
                    return (
                      <tr
                        key={asset.publicId}
                        className="border-border/50 hover:bg-secondary/40 border-b last:border-0"
                      >
                        <td className="px-4 py-2.5">
                          <code className="text-foreground font-mono text-[11px]">
                            {asset.publicId}
                          </code>
                          {asset.legalHold ? (
                            <Badge variant="warn" className="ml-2">
                              {t("pages.placeLegalHold.picker.alreadyHeld")}
                            </Badge>
                          ) : null}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <Button
                            type="button"
                            variant={isPicked ? "outline" : "indigo"}
                            size="sm"
                            onClick={() => {
                              togglePicked(asset.publicId);
                            }}
                            aria-pressed={isPicked}
                          >
                            {isPicked ? (
                              <>
                                <X size={11} />
                                {t("pages.placeLegalHold.picker.remove")}
                              </>
                            ) : (
                              <>
                                <Plus size={11} />
                                {t("pages.placeLegalHold.fields.search")}
                              </>
                            )}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Basket */}
          {picked.size > 0 ? (
            <div className="border-border rounded-md border p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-foreground text-[12px] font-medium">
                  {t("pages.placeLegalHold.picker.basket")} ({picked.size})
                </span>
                <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
                  {t("pages.placeLegalHold.picker.clearAll")}
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[...picked].map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      togglePicked(id);
                    }}
                    className="border-border bg-secondary hover:bg-secondary/70 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]"
                    aria-label={`${t("pages.placeLegalHold.picker.remove")} ${id}`}
                  >
                    <code className="font-mono">{id}</code>
                    <X size={10} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-[12px]">
              {t("pages.placeLegalHold.picker.basketEmpty")}
            </p>
          )}
        </NumberedSection>

        {/* ── Section 3: Reason ────────────────────────── */}
        <NumberedSection
          num={3}
          labelledBy="section-reason"
          title={t("pages.placeLegalHold.sections.reason")}
        >
          <div className="grid gap-2">
            <FieldLabel htmlFor="plh-description">
              {t("pages.placeLegalHold.fields.description")}
            </FieldLabel>
            <TextArea
              id="plh-description"
              rows={4}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
              }}
              maxLength={DESCRIPTION_MAX}
            />
            <p className="text-muted-foreground mt-1 text-[11px]">
              {t("pages.placeLegalHold.fields.descriptionCounter", {
                count: description.length,
              })}
            </p>
          </div>
        </NumberedSection>

        {/* ── Section 4: Acknowledgement ────────────────── */}
        <NumberedSection
          num={4}
          labelledBy="section-acknowledge"
          title={t("pages.placeLegalHold.sections.acknowledge")}
        >
          <div className="flex items-center gap-3">
            <input
              id="plh-acknowledged"
              type="checkbox"
              className="h-4 w-4 rounded"
              checked={acknowledged}
              onChange={(e) => {
                setAcknowledged(e.target.checked);
              }}
            />
            <FieldLabel htmlFor="plh-acknowledged">
              {t("pages.placeLegalHold.acknowledgement")}
            </FieldLabel>
          </div>
        </NumberedSection>

        {/* ── Sticky footer ─────────────────────────────── */}
        <div className="border-border/40 bg-background/95 sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t pt-4 pb-2 backdrop-blur-sm">
          <p className="text-muted-foreground text-[12.5px]">
            {picked.size > 0
              ? t("pages.placeLegalHold.footer.summary", { count: picked.size })
              : null}
          </p>
          <div className="flex items-center gap-2">
            <Link to="/legal-holds">
              <Button type="button" variant="outline">
                {t("pages.placeLegalHold.footer.cancel")}
              </Button>
            </Link>
            <Button
              type="submit"
              form="place-legal-hold-form"
              variant="indigo"
              disabled={!canSubmit}
            >
              {t("pages.placeLegalHold.footer.submit")}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
