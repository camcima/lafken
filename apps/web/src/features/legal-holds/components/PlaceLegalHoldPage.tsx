import { zodResolver } from "@hookform/resolvers/zod";
import { AssetImage } from "@lafken/react";
import type { AssetResponseDTO } from "@shared/backend-api";
import {
  LEGAL_HOLD_ASSET_IDS_MAX,
  LEGAL_HOLD_CASE_REFERENCE_MAX_LENGTH,
  LEGAL_HOLD_CASE_REFERENCE_MIN_LENGTH,
  LEGAL_HOLD_DESCRIPTION_MAX_LENGTH,
  LEGAL_HOLD_DESCRIPTION_MIN_LENGTH,
} from "@shared/backend-api/validation";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Plus, Search, X } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";

import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { SELECT_CLASS } from "@/components/common/select-styles";
import { useAssets } from "@/features/assets/hooks/useAssets";
import { usePlaceLegalHold } from "@/features/legal-holds/hooks/useLegalHoldMutations";
import { useNamespaces } from "@/features/namespaces/hooks/useNamespaces";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { cn } from "@/lib/utils";

// Photoshop-style transparency checker reused from the asset list / hero so
// thumbnails on this picker stay consistent with the rest of the console.
const CHECKER_STYLE: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(45deg, rgba(128,128,128,0.18) 25%, transparent 25%, transparent 75%, rgba(128,128,128,0.18) 75%, rgba(128,128,128,0.18))," +
    "linear-gradient(45deg, rgba(128,128,128,0.18) 25%, transparent 25%, transparent 75%, rgba(128,128,128,0.18) 75%, rgba(128,128,128,0.18))",
  backgroundSize: "8px 8px",
  backgroundPosition: "0 0, 4px 4px",
};

interface IPickerThumbProps {
  asset: AssetResponseDTO;
  size: "sm" | "md";
}

function PickerThumb({ asset, size }: IPickerThumbProps): React.JSX.Element {
  const dims: string = size === "sm" ? "h-9 w-12" : "h-10 w-14";
  return (
    <div
      className={cn(
        "border-border bg-card relative flex-none overflow-hidden rounded border",
        dims,
      )}
      style={CHECKER_STYLE}
    >
      <AssetImage
        publicId={asset.publicId}
        preset="lafken:thumbnail"
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
    </div>
  );
}

// ── Constants ──────────────────────────────────────────────
const PAGE_SIZE = 25;
const NAMESPACE_LIMIT = 100;

// ── Form value types ──────────────────────────────────────
interface IPlaceHoldFormValues {
  caseReference: string;
  description: string;
  assetIds: string[];
  acknowledged: boolean;
}

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

  // Picker state. Storing the full AssetResponseDTO per pick (not just the
  // publicId) lets the basket render thumbnails even after the user changes
  // the namespace/search filter and the picked asset is no longer in the
  // currently-visible page.
  const [namespaceSlug, setNamespaceSlug] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [picked, setPicked] = useState(new Map<string, AssetResponseDTO>());

  const namespacesQuery = useNamespaces({ limit: NAMESPACE_LIMIT });
  const namespaces = namespacesQuery.data?.data ?? [];

  const assetsQuery = useAssets({
    namespaceSlug: namespaceSlug !== "" ? namespaceSlug : undefined,
    q: searchQuery !== "" ? searchQuery : undefined,
    page: 1,
    limit: PAGE_SIZE,
  });
  const assets: AssetResponseDTO[] = assetsQuery.data?.data ?? [];

  const schema = useMemo(
    () =>
      z.object({
        caseReference: z
          .string()
          .min(LEGAL_HOLD_CASE_REFERENCE_MIN_LENGTH, t("pages.placeLegalHold.errors.caseReference"))
          .max(
            LEGAL_HOLD_CASE_REFERENCE_MAX_LENGTH,
            t("pages.placeLegalHold.errors.caseReference"),
          ),
        description: z
          .string()
          .min(LEGAL_HOLD_DESCRIPTION_MIN_LENGTH, t("pages.placeLegalHold.errors.description"))
          .max(LEGAL_HOLD_DESCRIPTION_MAX_LENGTH, t("pages.placeLegalHold.errors.description")),
        assetIds: z
          .array(z.uuid())
          .min(1, t("pages.placeLegalHold.errors.assetIds"))
          .max(LEGAL_HOLD_ASSET_IDS_MAX),
        // z.literal(true) would infer the field as the literal type `true`,
        // which conflicts with IPlaceHoldFormValues's `acknowledged: boolean`
        // (needed so the checkbox can default to false). z.boolean().refine
        // keeps the inferred type as `boolean` while still requiring `true`.
        acknowledged: z
          .boolean()
          .refine((val) => val === true, { error: t("pages.placeLegalHold.errors.acknowledged") }),
      }),
    [t],
  );

  const form = useForm<IPlaceHoldFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { caseReference: "", description: "", assetIds: [], acknowledged: false },
    mode: "onBlur",
  });
  const {
    handleSubmit,
    register,
    setError,
    setValue,
    control,
    formState: { errors, isDirty, isSubmitting, isSubmitSuccessful },
  } = form;

  // useWatch (not the destructured `watch()` from useForm) so this
  // subscription is compatible with the React Compiler's memoization.
  const descriptionValue = useWatch({ control, name: "description" });

  useUnsavedChangesGuard(isDirty && !isSubmitting && !isSubmitSuccessful);

  // Mirror the basket into the form's assetIds field so Zod validates it and
  // the wire body is built from a single source of truth.
  useEffect(() => {
    setValue("assetIds", [...picked.keys()], { shouldDirty: true, shouldValidate: false });
  }, [picked, setValue]);

  // ── Basket helpers ─────────────────────────────────────────
  function togglePicked(asset: AssetResponseDTO): void {
    setPicked((prev) => {
      const next = new Map(prev);
      if (next.has(asset.publicId)) {
        next.delete(asset.publicId);
      } else {
        next.set(asset.publicId, asset);
      }
      return next;
    });
  }

  function removePicked(publicId: string): void {
    setPicked((prev) => {
      const next = new Map(prev);
      next.delete(publicId);
      return next;
    });
  }

  function addAllVisible(): void {
    setPicked((prev) => {
      const next = new Map(prev);
      for (const asset of assets) {
        next.set(asset.publicId, asset);
      }
      return next;
    });
  }

  function clearAll(): void {
    setPicked(new Map());
  }

  // ── Submit ───────────────────────────────────────────────
  async function onSubmit(values: IPlaceHoldFormValues): Promise<void> {
    try {
      await placeMutation.mutateAsync({
        caseReference: values.caseReference,
        description: values.description,
        assetIds: values.assetIds,
        assetInternalIds: [...picked.values()].map((asset) => asset.id),
      });
      toast.success(
        t("pages.placeLegalHold.toast.success", { caseReference: values.caseReference }),
      );
      await navigate({ to: "/legal-holds" });
    } catch (err) {
      // setError keeps isSubmitSuccessful false so the unsaved-changes guard stays armed.
      setError("root", {
        type: "server",
        message: err instanceof Error ? err.message : String(err),
      });
      toast.error(
        t("pages.placeLegalHold.toast.failure", {
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
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

      <form
        id="place-legal-hold-form"
        onSubmit={(e) => void handleSubmit(onSubmit)(e)}
        className="space-y-4"
        noValidate
      >
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
              aria-invalid={errors.caseReference ? true : undefined}
              placeholder="CHL-AVN-2026-014"
              {...register("caseReference")}
            />
            <p className="text-muted-foreground mt-1 text-[11px]">
              {t("pages.placeLegalHold.fields.caseReferenceHint")}
            </p>
            {errors.caseReference?.message ? (
              <p role="alert" className="text-destructive mt-1 text-[11px]">
                {errors.caseReference.message}
              </p>
            ) : null}
          </div>
        </NumberedSection>

        {/* ── Section 2: Picker ────────────────────────── */}
        <NumberedSection
          num={2}
          labelledBy="section-picker"
          title={t("pages.placeLegalHold.sections.picker")}
        >
          {/* Namespace + search controls — match the filter-row styling used
              on the assets / namespaces list pages so font / height stay
              consistent with the rest of the app. */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={namespaceSlug}
              onChange={(e) => {
                setNamespaceSlug(e.target.value);
              }}
              className={SELECT_CLASS}
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
                className="border-input bg-card placeholder:text-muted-foreground focus:ring-ring h-9 w-full rounded-md border pr-3 pl-9 text-[12.5px] focus:ring-1 focus:outline-none"
                aria-label={t("pages.placeLegalHold.fields.search")}
              />
            </div>

            <Button type="button" variant="outline" size="sm" onClick={addAllVisible}>
              <Plus size={12} />
              {t("pages.placeLegalHold.picker.addAllVisible")}
            </Button>
          </div>

          {/* Two-pane: results on the left, basket on the right. */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            {/* Results list */}
            <div className="border-border rounded-md border">
              {assets.length === 0 ? (
                <div className="text-muted-foreground px-4 py-6 text-center text-[12.5px]">
                  {t("pages.placeLegalHold.picker.noResults")}
                </div>
              ) : (
                <ul className="divide-border/50 divide-y">
                  {assets.map((asset) => {
                    const isPicked: boolean = picked.has(asset.publicId);
                    return (
                      <li
                        key={asset.publicId}
                        className="hover:bg-secondary/40 flex items-center gap-3 px-3 py-2"
                      >
                        <PickerThumb asset={asset} size="sm" />
                        <div className="min-w-0 flex-1">
                          <code className="text-foreground block truncate font-mono text-[11px]">
                            {asset.publicId}
                          </code>
                          {asset.legalHold ? (
                            <Badge variant="warn" className="mt-1">
                              {t("pages.placeLegalHold.picker.alreadyHeld")}
                            </Badge>
                          ) : null}
                        </div>
                        <Button
                          type="button"
                          variant={isPicked ? "outline" : "indigo"}
                          size="sm"
                          onClick={() => {
                            togglePicked(asset);
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
                              {t("pages.placeLegalHold.picker.add")}
                            </>
                          )}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Basket */}
            <div className="border-border rounded-md border">
              <div className="border-border/60 bg-secondary/30 flex items-center justify-between border-b px-3 py-2">
                <span className="text-foreground text-[12px] font-medium">
                  {t("pages.placeLegalHold.picker.basket")} ({picked.size})
                </span>
                {picked.size > 0 ? (
                  <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
                    {t("pages.placeLegalHold.picker.clearAll")}
                  </Button>
                ) : null}
              </div>
              {picked.size === 0 ? (
                <div className="text-muted-foreground px-3 py-6 text-center text-[12px]">
                  {t("pages.placeLegalHold.picker.basketEmpty")}
                </div>
              ) : (
                <ul className="divide-border/50 max-h-[420px] divide-y overflow-y-auto">
                  {[...picked.values()].map((asset) => (
                    <li key={asset.publicId} className="flex items-center gap-2 px-3 py-2">
                      <PickerThumb asset={asset} size="sm" />
                      <code className="text-foreground min-w-0 flex-1 truncate font-mono text-[11px]">
                        {asset.publicId}
                      </code>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          removePicked(asset.publicId);
                        }}
                        aria-label={`${t("pages.placeLegalHold.picker.remove")} ${asset.publicId}`}
                      >
                        <X size={11} />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          {errors.assetIds?.message ? (
            <p role="alert" className="text-destructive mt-1 text-[11px]">
              {errors.assetIds.message}
            </p>
          ) : null}
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
              aria-invalid={errors.description ? true : undefined}
              {...register("description")}
            />
            <p className="text-muted-foreground mt-1 text-[11px]">
              {t("pages.placeLegalHold.fields.descriptionCounter", {
                count: descriptionValue.length,
              })}
            </p>
            {errors.description?.message ? (
              <p role="alert" className="text-destructive mt-1 text-[11px]">
                {errors.description.message}
              </p>
            ) : null}
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
              aria-invalid={errors.acknowledged ? true : undefined}
              {...register("acknowledged")}
            />
            <FieldLabel htmlFor="plh-acknowledged">
              {t("pages.placeLegalHold.acknowledgement")}
            </FieldLabel>
            {errors.acknowledged?.message ? (
              <p role="alert" className="text-destructive text-[11px]">
                {errors.acknowledged.message}
              </p>
            ) : null}
          </div>
        </NumberedSection>

        {errors.root?.message ? (
          <div
            role="alert"
            className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-4 py-3 text-sm"
          >
            {errors.root.message}
          </div>
        ) : null}

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
              disabled={isSubmitting || placeMutation.isPending}
            >
              {t("pages.placeLegalHold.footer.submit")}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
