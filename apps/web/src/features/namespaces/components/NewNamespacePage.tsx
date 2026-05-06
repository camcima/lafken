import { zodResolver } from "@hookform/resolvers/zod";
import type { StorageBindingResponseDTO } from "@shared/backend-api";
import { Link, useNavigate } from "@tanstack/react-router";
import React, { useMemo } from "react";
import type { Control } from "react-hook-form";
import { useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { RadioCardGroup } from "@/features/namespaces/components/PresetFormShared";
import { useCreateNamespace } from "@/features/namespaces/hooks/useNamespaces";
import { useStorageBindings } from "@/features/system/hooks/useSystem";
import { ApiError } from "@/lib/api/api-error";
import { extractProblemTypeSuffix } from "@/lib/api/problem-types";
import { cn } from "@/lib/utils";

// ── Constants ─────────────────────────────────────────────
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG_LENGTH = 64;
const MAX_DISPLAY_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_FILE_SIZE_BYTES = 5_368_709_120;
const MAX_TTL_SECONDS = 604_800;
const MAX_SIGNED_URL_BUCKET_SECONDS = 86_400;
const MAX_RETENTION_DAYS = 36_500;
const DEFAULT_MAX_FILE_SIZE = 52_428_800;
const DEFAULT_SIGNED_URL_TTL = 3600;
const DEFAULT_SIGNED_URL_BUCKET_SIZE = 300;

// ── Form value types ──────────────────────────────────────
// All fields are strings, numbers, or booleans matching raw HTML input values.
// Coercion to API types happens in onSubmit.
interface IFormValues {
  slug: string;
  displayName: string;
  description: string;
  storageBindingId: string;
  maxFileSizeBytes: string;
  allowedMimeTypesRaw: string;
  virusScanRequired: boolean;
  retentionDays: string;
  retentionMode: "delete" | "archive" | "none";
  exifHandling: "strip" | "preserve" | "extract_then_strip";
  immutable: boolean;
  servingMode: "public" | "signed" | "proxied";
  signedUrlTtlSeconds: string;
  signedUrlBucketSize: string;
  contentModerationRaw: string;
  requiredMetadataSchemaRaw: string;
  retryConfigRaw: string;
}

// ── Known form fields (for violation mapping) ─────────────
const KNOWN_VIOLATION_FIELDS: ReadonlyArray<keyof IFormValues> = [
  "slug",
  "displayName",
  "description",
  "storageBindingId",
  "maxFileSizeBytes",
  "allowedMimeTypesRaw",
  "virusScanRequired",
  "retentionDays",
  "retentionMode",
  "exifHandling",
  "immutable",
  "servingMode",
  "signedUrlTtlSeconds",
  "signedUrlBucketSize",
];

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

function SelectInput(
  props: Readonly<React.SelectHTMLAttributes<HTMLSelectElement>>,
): React.JSX.Element {
  const { className, ...rest } = props;
  return (
    <select
      className={cn(
        "border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm",
        "ring-offset-background",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...rest}
    />
  );
}

function FieldMessage({
  id,
  children,
}: Readonly<{ id?: string; children?: React.ReactNode }>): React.JSX.Element | null {
  if (!children) return null;
  return (
    <p id={id} className="text-destructive mt-1 text-[11px]">
      {children}
    </p>
  );
}

function FieldHelp({
  id,
  children,
}: Readonly<{ id?: string; children?: React.ReactNode }>): React.JSX.Element | null {
  if (!children) return null;
  return (
    <p id={id} className="text-muted-foreground mt-1 text-[11px]">
      {children}
    </p>
  );
}

interface INumberedSectionProps {
  num: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
  labelledBy: string;
}

function NumberedSection(props: Readonly<INumberedSectionProps>): React.JSX.Element {
  const { num, title, hint, labelledBy, children } = props;
  const numStr = String(num).padStart(2, "0");
  return (
    <Card className="p-0" aria-labelledby={labelledBy}>
      <div className="border-border/60 flex items-baseline gap-3 border-b px-6 py-4">
        <span className="text-latam-pink font-mono text-[11px] tabular-nums">{numStr}</span>
        <div className="flex-1">
          <h2
            id={labelledBy}
            className="text-foreground m-0 text-[14px] font-semibold tracking-tight"
          >
            {title}
          </h2>
          {hint ? <div className="text-muted-foreground mt-0.5 text-[11.5px]">{hint}</div> : null}
        </div>
      </div>
      <div className="space-y-4 px-6 py-5">{children}</div>
    </Card>
  );
}

// ── Helpers ────────────────────────────────────────────────
function isValidJson(jsonStr: string): boolean {
  try {
    JSON.parse(jsonStr);
    return true;
  } catch {
    return false;
  }
}

// ── Live YAML preview ─────────────────────────────────────
interface IYamlPreviewProps {
  control: Control<IFormValues>;
  bindings: ReadonlyArray<StorageBindingResponseDTO>;
}

function YamlPreview({ control, bindings }: Readonly<IYamlPreviewProps>): React.JSX.Element {
  const values = useWatch({ control });

  const yaml = useMemo(() => {
    const slug = (values.slug ?? "").trim() || "<slug>";
    const displayName = (values.displayName ?? "").trim() || "<display name>";
    const description = (values.description ?? "").trim();
    const storageBindingId = values.storageBindingId ?? "";
    const bindingName = bindings.find((b) => b.id === storageBindingId)?.name ?? "<none>";
    const maxBytes = values.maxFileSizeBytes ?? "0";
    const mimeTypes = (values.allowedMimeTypesRaw ?? "")
      .split(",")
      .map((mime) => mime.trim())
      .filter(Boolean);
    const requireVirusScan = values.virusScanRequired ?? false;
    const retentionDays = values.retentionDays ?? "";
    const retentionMode = values.retentionMode ?? "none";
    const exifHandling = values.exifHandling ?? "strip";
    const immutable = values.immutable ?? false;
    const servingMode = values.servingMode ?? "signed";
    const signedTtl = values.signedUrlTtlSeconds ?? "";
    const signedBucket = values.signedUrlBucketSize ?? "";

    const lines: string[] = [];
    lines.push("apiVersion: lafken.latam.com/v1");
    lines.push("kind: Namespace");
    lines.push("metadata:");
    lines.push(`  slug: ${slug}`);
    lines.push(`  displayName: "${displayName}"`);
    if (description) lines.push(`  description: "${description}"`);
    lines.push("spec:");
    lines.push("  storage:");
    lines.push(`    binding: ${bindingName}`);
    lines.push("  validation:");
    lines.push(`    maxBytes: ${maxBytes || "0"}`);
    lines.push("    mimeTypes:");
    if (mimeTypes.length === 0) {
      lines.push("      []");
    } else {
      for (const mime of mimeTypes) lines.push(`      - ${mime}`);
    }
    lines.push(`    requireVirusScan: ${String(requireVirusScan)}`);
    lines.push("  lifecycle:");
    if (retentionDays) lines.push(`    retentionDays: ${retentionDays}`);
    lines.push(`    retentionMode: ${retentionMode}`);
    lines.push(`    exifHandling: ${exifHandling}`);
    lines.push(`    immutable: ${String(immutable)}`);
    lines.push("  serving:");
    lines.push(`    mode: ${servingMode}`);
    if (servingMode === "signed") {
      if (signedTtl) lines.push(`    signedUrlTtlSec: ${signedTtl}`);
      if (signedBucket) lines.push(`    signedUrlBucketSize: ${signedBucket}`);
    }
    return lines.join("\n");
  }, [values, bindings]);

  return (
    <pre className="m-0 max-h-[640px] overflow-auto rounded-md bg-[#0F0A2E] px-4 py-3 font-mono text-[11px] leading-[1.6] text-[#C2D0E0]">
      {yaml}
    </pre>
  );
}

// ── Main component ─────────────────────────────────────────
export function NewNamespacePage(): React.JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createMutation = useCreateNamespace();
  const bindingsQuery = useStorageBindings();
  const bindings: StorageBindingResponseDTO[] = bindingsQuery.data ?? [];
  const hasBindings = bindings.length > 0;

  const schema = useMemo(
    () =>
      z.object({
        slug: z
          .string()
          .min(1)
          .max(MAX_SLUG_LENGTH)
          .regex(SLUG_PATTERN, t("pages.namespaces.errors.invalidSlug")),
        displayName: z.string().min(1).max(MAX_DISPLAY_NAME_LENGTH),
        description: z.string().max(MAX_DESCRIPTION_LENGTH),
        storageBindingId: z.uuid(),
        maxFileSizeBytes: z
          .string()
          .refine(
            (val) =>
              val !== "" &&
              Number.isInteger(Number(val)) &&
              Number(val) >= 1 &&
              Number(val) <= MAX_FILE_SIZE_BYTES,
            { message: `Must be between 1 and ${MAX_FILE_SIZE_BYTES}` },
          ),
        allowedMimeTypesRaw: z.string().min(1),
        virusScanRequired: z.boolean(),
        retentionDays: z
          .string()
          .refine(
            (val) =>
              val === "" ||
              (Number.isInteger(Number(val)) &&
                Number(val) >= 1 &&
                Number(val) <= MAX_RETENTION_DAYS),
            { message: `Must be between 1 and ${MAX_RETENTION_DAYS}` },
          ),
        retentionMode: z.enum(["delete", "archive", "none"]),
        exifHandling: z.enum(["strip", "preserve", "extract_then_strip"]),
        immutable: z.boolean(),
        servingMode: z.enum(["public", "signed", "proxied"]),
        signedUrlTtlSeconds: z
          .string()
          .refine(
            (val) =>
              val === "" ||
              (Number.isInteger(Number(val)) && Number(val) >= 1 && Number(val) <= MAX_TTL_SECONDS),
            { message: `Must be between 1 and ${MAX_TTL_SECONDS}` },
          ),
        signedUrlBucketSize: z
          .string()
          .refine(
            (val) =>
              val === "" ||
              (Number.isInteger(Number(val)) &&
                Number(val) >= 1 &&
                Number(val) <= MAX_SIGNED_URL_BUCKET_SECONDS),
            { message: `Must be between 1 and ${MAX_SIGNED_URL_BUCKET_SECONDS}` },
          ),
        contentModerationRaw: z.string().refine((val) => val === "" || isValidJson(val), {
          message: t("pages.namespaces.errors.invalidJson"),
        }),
        requiredMetadataSchemaRaw: z.string().refine((val) => val === "" || isValidJson(val), {
          message: t("pages.namespaces.errors.invalidJson"),
        }),
        retryConfigRaw: z.string().refine((val) => val === "" || isValidJson(val), {
          message: t("pages.namespaces.errors.invalidJson"),
        }),
      }),
    [t],
  );

  const form = useForm<IFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      slug: "",
      displayName: "",
      description: "",
      storageBindingId: "",
      maxFileSizeBytes: String(DEFAULT_MAX_FILE_SIZE),
      allowedMimeTypesRaw: "image/jpeg, image/png, image/webp",
      virusScanRequired: true,
      retentionDays: "",
      retentionMode: "none",
      exifHandling: "strip",
      immutable: false,
      servingMode: "signed",
      signedUrlTtlSeconds: String(DEFAULT_SIGNED_URL_TTL),
      signedUrlBucketSize: String(DEFAULT_SIGNED_URL_BUCKET_SIZE),
      contentModerationRaw: "",
      requiredMetadataSchemaRaw: "",
      retryConfigRaw: "",
    },
    mode: "onBlur",
  });

  const {
    handleSubmit,
    register,
    setError,
    formState: { errors, isSubmitting },
  } = form;

  const isPending = createMutation.isPending;
  const isBusy = isSubmitting || isPending;
  const formLevelError = errors.root?.message;
  const formLevelErrorType = errors.root?.type;

  function applyApiError(err: unknown): void {
    if (!(err instanceof ApiError)) {
      setError("root", {
        type: "generic",
        message: t("pages.namespaces.errors.generic"),
      });
      return;
    }

    const suffix = extractProblemTypeSuffix(err.body.type);
    const params = err.body.params ?? {};

    if (suffix === "namespace-already-exists-error") {
      setError("slug", {
        type: "manual",
        message: t("pages.namespaces.errors.duplicateSlug"),
      });
      return;
    }

    if (suffix === "storage-binding-missing-error") {
      setError("root", {
        type: "storage-missing",
        message: t("pages.namespaces.errors.storageMissing"),
      });
      return;
    }

    if (suffix === "invalid-slug-error") {
      setError("slug", {
        type: "manual",
        message: t("pages.namespaces.errors.invalidSlug"),
      });
      return;
    }

    const violations = Array.isArray(params.violations) ? params.violations : [];
    if (violations.length > 0) {
      let mappedAny = false;
      for (const violation of violations) {
        if (
          violation &&
          typeof violation === "object" &&
          "path" in violation &&
          "message" in violation
        ) {
          const path = (violation as { path: unknown }).path;
          const message = (violation as { message: unknown }).message;
          if (typeof path !== "string" || typeof message !== "string") continue;
          const field = KNOWN_VIOLATION_FIELDS.find((name) => name === path);
          if (field) {
            setError(field, { type: "server", message });
            mappedAny = true;
          }
        }
      }
      if (!mappedAny) {
        setError("root", {
          type: "generic",
          message: err.body.detail ?? t("pages.namespaces.errors.generic"),
        });
      }
      return;
    }

    setError("root", {
      type: "generic",
      message: err.body.detail ?? t("pages.namespaces.errors.generic"),
    });
  }

  async function onSubmit(values: IFormValues): Promise<void> {
    const allowedMimeTypes = values.allowedMimeTypesRaw
      .split(",")
      .map((mime) => mime.trim())
      .filter(Boolean);

    const contentModeration =
      values.contentModerationRaw.trim() !== ""
        ? (JSON.parse(values.contentModerationRaw) as Record<string, unknown>)
        : null;

    const requiredMetadataSchema =
      values.requiredMetadataSchemaRaw.trim() !== ""
        ? (JSON.parse(values.requiredMetadataSchemaRaw) as Record<string, unknown>)
        : null;

    const retryConfig =
      values.retryConfigRaw.trim() !== ""
        ? (JSON.parse(values.retryConfigRaw) as Record<string, unknown>)
        : null;

    const retentionDays = values.retentionDays === "" ? null : Number(values.retentionDays);
    const signedUrlTtlSeconds =
      values.signedUrlTtlSeconds === "" ? null : Number(values.signedUrlTtlSeconds);
    const signedUrlBucketSize =
      values.signedUrlBucketSize === "" ? null : Number(values.signedUrlBucketSize);

    try {
      const created = await createMutation.mutateAsync({
        slug: values.slug,
        displayName: values.displayName,
        description: values.description !== "" ? values.description : null,
        storageBindingId: values.storageBindingId,
        policy: {
          retentionDays,
          retentionMode: values.retentionMode,
          maxFileSizeBytes: Number(values.maxFileSizeBytes),
          allowedMimeTypes,
          exifHandling: values.exifHandling,
          virusScanRequired: values.virusScanRequired,
          contentModeration,
          requiredMetadataSchema,
          immutable: values.immutable,
          servingMode: values.servingMode,
          signedUrlTtlSeconds,
          signedUrlBucketSize,
          retryConfig,
        },
      });
      await navigate({
        to: "/namespaces/$slug",
        params: { slug: created.slug },
      });
    } catch (err) {
      applyApiError(err);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      {/* Page header */}
      <div>
        <h1 className="text-[22px] font-bold tracking-tight">{t("pages.namespaces.form.title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("pages.namespaces.form.subtitle")}</p>
      </div>

      {/* No bindings warning */}
      {!hasBindings ? (
        <div
          role="alert"
          className="border-warn/40 bg-warn/10 text-warn rounded-md border px-4 py-3 text-sm"
        >
          {t("pages.namespaces.errors.noStorageBindings")}{" "}
          <Link to="/system" className="underline">
            {t("pages.namespaces.errors.noStorageBindingsLink")}
          </Link>
        </div>
      ) : null}

      {/* Form-level error */}
      {formLevelError ? (
        <div
          id="new-namespace-form-error"
          role="alert"
          className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-4 py-3 text-sm"
        >
          {formLevelError}
          {formLevelErrorType === "storage-missing" ? (
            <>
              {" "}
              <Link to="/system" className="underline">
                {t("pages.namespaces.errors.storageMissingLink")}
              </Link>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <form
          id="new-namespace-form"
          onSubmit={(e) => void handleSubmit(onSubmit)(e)}
          className="space-y-4"
          noValidate
        >
          {/* ── Section 1: Identity ───────────────────────────── */}
          <NumberedSection
            num={1}
            labelledBy="section-identity"
            title={t("pages.namespaces.form.sections.identity")}
            hint={t("pages.namespaces.form.sections.identityHint")}
          >
            {/* Slug */}
            <div className="grid gap-2">
              <FieldLabel htmlFor="ns-slug">{t("pages.namespaces.form.fields.slug")}</FieldLabel>
              <TextInput
                id="ns-slug"
                aria-invalid={errors.slug ? true : undefined}
                aria-describedby={errors.slug ? "ns-slug-error" : "ns-slug-help"}
                {...register("slug")}
              />
              <FieldHelp id="ns-slug-help">{t("pages.namespaces.form.fields.slugHelp")}</FieldHelp>
              {errors.slug?.message ? (
                <FieldMessage id="ns-slug-error">{errors.slug.message}</FieldMessage>
              ) : null}
            </div>

            {/* Display name */}
            <div className="grid gap-2">
              <FieldLabel htmlFor="ns-display-name">
                {t("pages.namespaces.form.fields.displayName")}
              </FieldLabel>
              <TextInput
                id="ns-display-name"
                aria-invalid={errors.displayName ? true : undefined}
                aria-describedby={errors.displayName ? "ns-display-name-error" : undefined}
                {...register("displayName")}
              />
              {errors.displayName?.message ? (
                <FieldMessage id="ns-display-name-error">{errors.displayName.message}</FieldMessage>
              ) : null}
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <FieldLabel htmlFor="ns-description">
                {t("pages.namespaces.form.fields.description")}
              </FieldLabel>
              <TextArea
                id="ns-description"
                rows={4}
                aria-invalid={errors.description ? true : undefined}
                aria-describedby={errors.description ? "ns-description-error" : undefined}
                {...register("description")}
              />
              {errors.description?.message ? (
                <FieldMessage id="ns-description-error">{errors.description.message}</FieldMessage>
              ) : null}
            </div>
          </NumberedSection>

          {/* ── Section 2: Storage ────────────────────────────── */}
          <NumberedSection
            num={2}
            labelledBy="section-storage"
            title={t("pages.namespaces.form.sections.storage")}
            hint={t("pages.namespaces.form.sections.storageHint")}
          >
            <div className="grid gap-2">
              <FieldLabel htmlFor="ns-storage-binding">
                {t("pages.namespaces.form.fields.storageBinding")}
              </FieldLabel>
              <SelectInput
                id="ns-storage-binding"
                aria-invalid={errors.storageBindingId ? true : undefined}
                aria-describedby={errors.storageBindingId ? "ns-storage-binding-error" : undefined}
                {...register("storageBindingId")}
              >
                <option value="">
                  {t("pages.namespaces.form.fields.storageBindingPlaceholder")}
                </option>
                {bindings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </SelectInput>
              {errors.storageBindingId?.message ? (
                <FieldMessage id="ns-storage-binding-error">
                  {errors.storageBindingId.message}
                </FieldMessage>
              ) : null}
            </div>
          </NumberedSection>

          {/* ── Section 3: Validation ─────────────────────────── */}
          <NumberedSection
            num={3}
            labelledBy="section-validation"
            title={t("pages.namespaces.form.sections.validation")}
            hint={t("pages.namespaces.form.sections.validationHint")}
          >
            {/* Max file size */}
            <div className="grid gap-2">
              <FieldLabel htmlFor="ns-max-file-size">
                {t("pages.namespaces.form.fields.maxFileSizeBytes")}
              </FieldLabel>
              <TextInput
                id="ns-max-file-size"
                type="number"
                min={1}
                max={MAX_FILE_SIZE_BYTES}
                aria-invalid={errors.maxFileSizeBytes ? true : undefined}
                aria-describedby={errors.maxFileSizeBytes ? "ns-max-file-size-error" : undefined}
                {...register("maxFileSizeBytes")}
              />
              {errors.maxFileSizeBytes?.message ? (
                <FieldMessage id="ns-max-file-size-error">
                  {errors.maxFileSizeBytes.message}
                </FieldMessage>
              ) : null}
            </div>

            {/* Allowed MIME types */}
            <div className="grid gap-2">
              <FieldLabel htmlFor="ns-allowed-mime-types">
                {t("pages.namespaces.form.fields.allowedMimeTypes")}
              </FieldLabel>
              <TextInput
                id="ns-allowed-mime-types"
                aria-invalid={errors.allowedMimeTypesRaw ? true : undefined}
                aria-describedby={
                  errors.allowedMimeTypesRaw
                    ? "ns-allowed-mime-types-error"
                    : "ns-allowed-mime-types-help"
                }
                {...register("allowedMimeTypesRaw")}
              />
              <FieldHelp id="ns-allowed-mime-types-help">
                {t("pages.namespaces.form.fields.allowedMimeTypesHelp")}
              </FieldHelp>
              {errors.allowedMimeTypesRaw?.message ? (
                <FieldMessage id="ns-allowed-mime-types-error">
                  {errors.allowedMimeTypesRaw.message}
                </FieldMessage>
              ) : null}
            </div>

            {/* Virus scan required */}
            <div className="flex items-center gap-3">
              <input
                id="ns-virus-scan"
                type="checkbox"
                className="h-4 w-4 rounded"
                aria-invalid={errors.virusScanRequired ? true : undefined}
                aria-describedby={errors.virusScanRequired ? "ns-virus-scan-error" : undefined}
                {...register("virusScanRequired")}
              />
              <FieldLabel htmlFor="ns-virus-scan">
                {t("pages.namespaces.form.fields.virusScanRequired")}
              </FieldLabel>
              {errors.virusScanRequired?.message ? (
                <FieldMessage id="ns-virus-scan-error">
                  {errors.virusScanRequired.message}
                </FieldMessage>
              ) : null}
            </div>
          </NumberedSection>

          {/* ── Section 4: Lifecycle ──────────────────────────── */}
          <NumberedSection
            num={4}
            labelledBy="section-lifecycle"
            title={t("pages.namespaces.form.sections.lifecycle")}
            hint={t("pages.namespaces.form.sections.lifecycleHint")}
          >
            {/* Retention days */}
            <div className="grid gap-2">
              <FieldLabel htmlFor="ns-retention-days">
                {t("pages.namespaces.form.fields.retentionDays")}
              </FieldLabel>
              <TextInput
                id="ns-retention-days"
                type="number"
                min={1}
                max={MAX_RETENTION_DAYS}
                placeholder="—"
                aria-invalid={errors.retentionDays ? true : undefined}
                aria-describedby={errors.retentionDays ? "ns-retention-days-error" : undefined}
                {...register("retentionDays")}
              />
              {errors.retentionDays?.message ? (
                <FieldMessage id="ns-retention-days-error">
                  {errors.retentionDays.message}
                </FieldMessage>
              ) : null}
            </div>

            {/* Retention mode */}
            <div className="grid gap-2">
              <span
                id="ns-retention-mode-label"
                className="text-foreground text-[11.5px] font-medium"
              >
                {t("pages.namespaces.form.fields.retentionMode")}
              </span>
              <RadioCardGroup<IFormValues, "delete" | "archive" | "none">
                control={form.control}
                register={register}
                name="retentionMode"
                ariaLabelledBy="ns-retention-mode-label"
                columns={3}
                options={[
                  {
                    value: "delete",
                    label: t("pages.namespaces.form.retentionMode.delete"),
                    description: t("pages.namespaces.form.retentionModeHints.delete"),
                  },
                  {
                    value: "archive",
                    label: t("pages.namespaces.form.retentionMode.archive"),
                    description: t("pages.namespaces.form.retentionModeHints.archive"),
                  },
                  {
                    value: "none",
                    label: t("pages.namespaces.form.retentionMode.none"),
                    description: t("pages.namespaces.form.retentionModeHints.none"),
                  },
                ]}
              />
              {errors.retentionMode?.message ? (
                <FieldMessage id="ns-retention-mode-error">
                  {errors.retentionMode.message}
                </FieldMessage>
              ) : null}
            </div>

            {/* EXIF handling */}
            <div className="grid gap-2">
              <span
                id="ns-exif-handling-label"
                className="text-foreground text-[11.5px] font-medium"
              >
                {t("pages.namespaces.form.fields.exifHandling")}
              </span>
              <RadioCardGroup<IFormValues, "strip" | "preserve" | "extract_then_strip">
                control={form.control}
                register={register}
                name="exifHandling"
                ariaLabelledBy="ns-exif-handling-label"
                columns={3}
                options={[
                  {
                    value: "strip",
                    label: t("pages.namespaces.form.exifHandling.strip"),
                    description: t("pages.namespaces.form.exifHandlingHints.strip"),
                  },
                  {
                    value: "preserve",
                    label: t("pages.namespaces.form.exifHandling.preserve"),
                    description: t("pages.namespaces.form.exifHandlingHints.preserve"),
                  },
                  {
                    value: "extract_then_strip",
                    label: t("pages.namespaces.form.exifHandling.extract_then_strip"),
                    description: t("pages.namespaces.form.exifHandlingHints.extract_then_strip"),
                  },
                ]}
              />
              {errors.exifHandling?.message ? (
                <FieldMessage id="ns-exif-handling-error">
                  {errors.exifHandling.message}
                </FieldMessage>
              ) : null}
            </div>

            {/* Immutable */}
            <div className="flex items-center gap-3">
              <input
                id="ns-immutable"
                type="checkbox"
                className="h-4 w-4 rounded"
                aria-invalid={errors.immutable ? true : undefined}
                aria-describedby={errors.immutable ? "ns-immutable-error" : undefined}
                {...register("immutable")}
              />
              <FieldLabel htmlFor="ns-immutable">
                {t("pages.namespaces.form.fields.immutable")}
              </FieldLabel>
              {errors.immutable?.message ? (
                <FieldMessage id="ns-immutable-error">{errors.immutable.message}</FieldMessage>
              ) : null}
            </div>
          </NumberedSection>

          {/* ── Section 5: Serving ────────────────────────────── */}
          <NumberedSection
            num={5}
            labelledBy="section-serving"
            title={t("pages.namespaces.form.sections.serving")}
            hint={t("pages.namespaces.form.sections.servingHint")}
          >
            {/* Serving mode */}
            <div className="grid gap-2">
              <span
                id="ns-serving-mode-label"
                className="text-foreground text-[11.5px] font-medium"
              >
                {t("pages.namespaces.form.fields.servingMode")}
              </span>
              <RadioCardGroup<IFormValues, "public" | "signed" | "proxied">
                control={form.control}
                register={register}
                name="servingMode"
                ariaLabelledBy="ns-serving-mode-label"
                columns={3}
                options={[
                  {
                    value: "public",
                    label: t("pages.namespaces.form.servingMode.public"),
                    description: t("pages.namespaces.form.servingModeHints.public"),
                  },
                  {
                    value: "signed",
                    label: t("pages.namespaces.form.servingMode.signed"),
                    description: t("pages.namespaces.form.servingModeHints.signed"),
                  },
                  {
                    value: "proxied",
                    label: t("pages.namespaces.form.servingMode.proxied"),
                    description: t("pages.namespaces.form.servingModeHints.proxied"),
                  },
                ]}
              />
              {errors.servingMode?.message ? (
                <FieldMessage id="ns-serving-mode-error">{errors.servingMode.message}</FieldMessage>
              ) : null}
            </div>

            {/* Signed URL TTL */}
            <div className="grid gap-2">
              <FieldLabel htmlFor="ns-signed-url-ttl">
                {t("pages.namespaces.form.fields.signedUrlTtlSeconds")}
              </FieldLabel>
              <TextInput
                id="ns-signed-url-ttl"
                type="number"
                min={1}
                max={MAX_TTL_SECONDS}
                aria-invalid={errors.signedUrlTtlSeconds ? true : undefined}
                aria-describedby={
                  errors.signedUrlTtlSeconds ? "ns-signed-url-ttl-error" : undefined
                }
                {...register("signedUrlTtlSeconds")}
              />
              {errors.signedUrlTtlSeconds?.message ? (
                <FieldMessage id="ns-signed-url-ttl-error">
                  {errors.signedUrlTtlSeconds.message}
                </FieldMessage>
              ) : null}
            </div>

            {/* Signed URL bucket size */}
            <div className="grid gap-2">
              <FieldLabel htmlFor="ns-signed-url-bucket-size">
                {t("pages.namespaces.form.fields.signedUrlBucketSize")}
              </FieldLabel>
              <TextInput
                id="ns-signed-url-bucket-size"
                type="number"
                min={1}
                max={MAX_SIGNED_URL_BUCKET_SECONDS}
                aria-invalid={errors.signedUrlBucketSize ? true : undefined}
                aria-describedby={
                  errors.signedUrlBucketSize ? "ns-signed-url-bucket-size-error" : undefined
                }
                {...register("signedUrlBucketSize")}
              />
              {errors.signedUrlBucketSize?.message ? (
                <FieldMessage id="ns-signed-url-bucket-size-error">
                  {errors.signedUrlBucketSize.message}
                </FieldMessage>
              ) : null}
            </div>
          </NumberedSection>

          {/* ── Section 6: Advanced ───────────────────────────── */}
          <NumberedSection
            num={6}
            labelledBy="section-advanced"
            title={t("pages.namespaces.form.sections.advanced")}
            hint={t("pages.namespaces.form.sections.advancedHint")}
          >
            {/* Content moderation */}
            <div className="grid gap-2">
              <FieldLabel htmlFor="ns-content-moderation">
                {t("pages.namespaces.form.fields.contentModeration")}
              </FieldLabel>
              <TextArea
                id="ns-content-moderation"
                rows={4}
                aria-invalid={errors.contentModerationRaw ? true : undefined}
                aria-describedby={
                  errors.contentModerationRaw ? "ns-content-moderation-error" : undefined
                }
                {...register("contentModerationRaw")}
              />
              {errors.contentModerationRaw?.message ? (
                <FieldMessage id="ns-content-moderation-error">
                  {errors.contentModerationRaw.message}
                </FieldMessage>
              ) : null}
            </div>

            {/* Required metadata schema */}
            <div className="grid gap-2">
              <FieldLabel htmlFor="ns-required-metadata-schema">
                {t("pages.namespaces.form.fields.requiredMetadataSchema")}
              </FieldLabel>
              <TextArea
                id="ns-required-metadata-schema"
                rows={4}
                aria-invalid={errors.requiredMetadataSchemaRaw ? true : undefined}
                aria-describedby={
                  errors.requiredMetadataSchemaRaw ? "ns-required-metadata-schema-error" : undefined
                }
                {...register("requiredMetadataSchemaRaw")}
              />
              {errors.requiredMetadataSchemaRaw?.message ? (
                <FieldMessage id="ns-required-metadata-schema-error">
                  {errors.requiredMetadataSchemaRaw.message}
                </FieldMessage>
              ) : null}
            </div>

            {/* Retry config */}
            <div className="grid gap-2">
              <FieldLabel htmlFor="ns-retry-config">
                {t("pages.namespaces.form.fields.retryConfig")}
              </FieldLabel>
              <TextArea
                id="ns-retry-config"
                rows={4}
                aria-invalid={errors.retryConfigRaw ? true : undefined}
                aria-describedby={errors.retryConfigRaw ? "ns-retry-config-error" : undefined}
                {...register("retryConfigRaw")}
              />
              {errors.retryConfigRaw?.message ? (
                <FieldMessage id="ns-retry-config-error">
                  {errors.retryConfigRaw.message}
                </FieldMessage>
              ) : null}
            </div>
          </NumberedSection>

          {/* ── Action bar ────────────────────────────────────── */}
          <div className="border-border/40 flex items-center justify-end gap-3 border-t pt-4">
            <Link to="/namespaces">
              <Button type="button" variant="outline" disabled={isBusy}>
                {t("pages.namespaces.form.cancel")}
              </Button>
            </Link>
            <Button
              type="submit"
              form="new-namespace-form"
              variant="indigo"
              disabled={isBusy || !hasBindings}
            >
              {t("pages.namespaces.form.submit")}
            </Button>
          </div>
        </form>

        {/* ── Live YAML preview rail ──────────────────────────── */}
        <aside
          aria-label={t("pages.namespaces.form.yamlPreviewLabel")}
          className="hidden lg:sticky lg:top-6 lg:block lg:self-start"
        >
          <div className="border-border/60 mb-2 flex items-center justify-between border-b pb-2">
            <span className="text-muted-foreground text-[10.5px] font-medium tracking-wider uppercase">
              {t("pages.namespaces.form.yamlPreviewTitle")}
            </span>
            <span className="text-muted-foreground font-mono text-[10.5px]">YAML</span>
          </div>
          <YamlPreview control={form.control} bindings={bindings} />
        </aside>
      </div>
    </div>
  );
}
