import { zodResolver } from "@hookform/resolvers/zod";
import type { StorageBindingResponseDTO } from "@shared/backend-api";
import { Link, useNavigate } from "@tanstack/react-router";
import React, { useMemo } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { Button } from "@/components/common/Button";
import { useCreateNamespace } from "@/features/namespaces/hooks/useNamespaces";
import { useStorageBindings } from "@/features/system/hooks/useSystem";
import { ApiError } from "@/lib/api/api-error";
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
const PROBLEM_TYPE_PREFIX = "https://lafken.dev/problems/";
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
  // eslint-disable-next-line jsx-a11y/label-has-associated-control
  return <label className={cn("text-foreground text-sm font-medium", className)} {...rest} />;
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
    <p id={id} className="text-destructive mt-1 text-xs">
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
    <p id={id} className="text-muted-foreground mt-1 text-xs">
      {children}
    </p>
  );
}

function SectionHeading({ children }: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return <h2 className="text-foreground mb-4 border-b pb-2 text-base font-semibold">{children}</h2>;
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

function extractErrorTypeSuffix(body: { type?: string }): string | undefined {
  if (!body.type || !body.type.startsWith(PROBLEM_TYPE_PREFIX)) return undefined;
  return body.type.slice(PROBLEM_TYPE_PREFIX.length);
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
        storageBindingId: z.string().min(1),
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

    const suffix = extractErrorTypeSuffix(err.body);
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
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
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

      <form
        id="new-namespace-form"
        onSubmit={(e) => void handleSubmit(onSubmit)(e)}
        className="space-y-8"
        noValidate
      >
        {/* ── Section 1: Identity ───────────────────────────── */}
        <section aria-labelledby="section-identity">
          <SectionHeading>
            <span id="section-identity">{t("pages.namespaces.form.sections.identity")}</span>
          </SectionHeading>
          <div className="space-y-4">
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
          </div>
        </section>

        {/* ── Section 2: Storage ────────────────────────────── */}
        <section aria-labelledby="section-storage">
          <SectionHeading>
            <span id="section-storage">{t("pages.namespaces.form.sections.storage")}</span>
          </SectionHeading>
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
        </section>

        {/* ── Section 3: Validation ─────────────────────────── */}
        <section aria-labelledby="section-validation">
          <SectionHeading>
            <span id="section-validation">{t("pages.namespaces.form.sections.validation")}</span>
          </SectionHeading>
          <div className="space-y-4">
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
          </div>
        </section>

        {/* ── Section 4: Lifecycle ──────────────────────────── */}
        <section aria-labelledby="section-lifecycle">
          <SectionHeading>
            <span id="section-lifecycle">{t("pages.namespaces.form.sections.lifecycle")}</span>
          </SectionHeading>
          <div className="space-y-4">
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
              <FieldLabel htmlFor="ns-retention-mode">
                {t("pages.namespaces.form.fields.retentionMode")}
              </FieldLabel>
              <SelectInput
                id="ns-retention-mode"
                aria-invalid={errors.retentionMode ? true : undefined}
                aria-describedby={errors.retentionMode ? "ns-retention-mode-error" : undefined}
                {...register("retentionMode")}
              >
                <option value="delete">{t("pages.namespaces.form.retentionMode.delete")}</option>
                <option value="archive">{t("pages.namespaces.form.retentionMode.archive")}</option>
                <option value="none">{t("pages.namespaces.form.retentionMode.none")}</option>
              </SelectInput>
              {errors.retentionMode?.message ? (
                <FieldMessage id="ns-retention-mode-error">
                  {errors.retentionMode.message}
                </FieldMessage>
              ) : null}
            </div>

            {/* EXIF handling */}
            <div className="grid gap-2">
              <FieldLabel htmlFor="ns-exif-handling">
                {t("pages.namespaces.form.fields.exifHandling")}
              </FieldLabel>
              <SelectInput
                id="ns-exif-handling"
                aria-invalid={errors.exifHandling ? true : undefined}
                aria-describedby={errors.exifHandling ? "ns-exif-handling-error" : undefined}
                {...register("exifHandling")}
              >
                <option value="strip">{t("pages.namespaces.form.exifHandling.strip")}</option>
                <option value="preserve">{t("pages.namespaces.form.exifHandling.preserve")}</option>
                <option value="extract_then_strip">
                  {t("pages.namespaces.form.exifHandling.extract_then_strip")}
                </option>
              </SelectInput>
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
          </div>
        </section>

        {/* ── Section 5: Serving ────────────────────────────── */}
        <section aria-labelledby="section-serving">
          <SectionHeading>
            <span id="section-serving">{t("pages.namespaces.form.sections.serving")}</span>
          </SectionHeading>
          <div className="space-y-4">
            {/* Serving mode */}
            <div className="grid gap-2">
              <FieldLabel htmlFor="ns-serving-mode">
                {t("pages.namespaces.form.fields.servingMode")}
              </FieldLabel>
              <SelectInput
                id="ns-serving-mode"
                aria-invalid={errors.servingMode ? true : undefined}
                aria-describedby={errors.servingMode ? "ns-serving-mode-error" : undefined}
                {...register("servingMode")}
              >
                <option value="public">{t("pages.namespaces.form.servingMode.public")}</option>
                <option value="signed">{t("pages.namespaces.form.servingMode.signed")}</option>
                <option value="proxied">{t("pages.namespaces.form.servingMode.proxied")}</option>
              </SelectInput>
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
          </div>
        </section>

        {/* ── Section 6: Advanced ───────────────────────────── */}
        <details>
          <summary
            id="section-advanced"
            className="text-foreground cursor-pointer border-b pb-2 text-base font-semibold"
          >
            {t("pages.namespaces.form.sections.advanced")}
          </summary>
          <div className="mt-4 space-y-4">
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
          </div>
        </details>

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
    </div>
  );
}
