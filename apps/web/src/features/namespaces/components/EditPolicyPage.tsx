import { zodResolver } from "@hookform/resolvers/zod";
import {
  POLICY_MAX_FILE_SIZE_BYTES,
  POLICY_MAX_RETENTION_DAYS,
  POLICY_MAX_SIGNED_URL_BUCKET_SIZE,
  POLICY_MAX_TTL_SECONDS,
} from "@shared/backend-api/validation";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import React, { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { Button } from "@/components/common/Button";
import {
  useNamespace,
  useNamespacePolicies,
  useUpdateNamespacePolicy,
} from "@/features/namespaces/hooks/useNamespaces";
import { ApiError } from "@/lib/api/api-error";
import { extractProblemTypeSuffix } from "@/lib/api/problem-types";
import { cn } from "@/lib/utils";

// ── Constants ─────────────────────────────────────────────
const DEFAULT_MAX_FILE_SIZE = 52_428_800;

// ── Form value types ──────────────────────────────────────
interface IFormValues {
  maxFileSizeBytes: string;
  allowedMimeTypesRaw: string;
  virusScanRequired: boolean;
  retentionDays: string;
  retentionMode: "delete" | "archive" | "none";
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
  "maxFileSizeBytes",
  "allowedMimeTypesRaw",
  "virusScanRequired",
  "retentionDays",
  "retentionMode",
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

function jsonToRaw(value: Record<string, unknown> | null | undefined): string {
  if (value === null || value === undefined) return "";
  return JSON.stringify(value, null, 2);
}

function numToStr(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

// ── Main component ─────────────────────────────────────────
export function EditPolicyPage(): React.JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { slug } = useParams({ from: "/_protected/namespaces/$slug_/policy/edit" });

  const namespaceQuery = useNamespace(slug);
  const policiesQuery = useNamespacePolicies(slug);

  const namespace = namespaceQuery.data;

  // Redirect to detail page if namespace is archived (defense-in-depth)
  useEffect(() => {
    if (namespace?.archivedAt) {
      void navigate({ to: "/namespaces/$slug", params: { slug } });
    }
  }, [namespace, navigate, slug]);

  // Find the current policy version to pre-fill the form
  const currentPolicyVersion = namespace?.currentPolicyVersion;
  const currentPolicy = useMemo(
    () => policiesQuery.data?.find((policy) => policy.version === currentPolicyVersion),
    [policiesQuery.data, currentPolicyVersion],
  );

  const updateMutation = useUpdateNamespacePolicy();

  const schema = useMemo(
    () =>
      z.object({
        maxFileSizeBytes: z
          .string()
          .refine(
            (val) =>
              val !== "" &&
              Number.isInteger(Number(val)) &&
              Number(val) >= 1 &&
              Number(val) <= POLICY_MAX_FILE_SIZE_BYTES,
            { message: `Must be between 1 and ${POLICY_MAX_FILE_SIZE_BYTES}` },
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
                Number(val) <= POLICY_MAX_RETENTION_DAYS),
            { message: `Must be between 1 and ${POLICY_MAX_RETENTION_DAYS}` },
          ),
        retentionMode: z.enum(["delete", "archive", "none"]),
        immutable: z.boolean(),
        servingMode: z.enum(["public", "signed", "proxied"]),
        signedUrlTtlSeconds: z
          .string()
          .refine(
            (val) =>
              val === "" ||
              (Number.isInteger(Number(val)) &&
                Number(val) >= 1 &&
                Number(val) <= POLICY_MAX_TTL_SECONDS),
            { message: `Must be between 1 and ${POLICY_MAX_TTL_SECONDS}` },
          ),
        signedUrlBucketSize: z
          .string()
          .refine(
            (val) =>
              val === "" ||
              (Number.isInteger(Number(val)) &&
                Number(val) >= 1 &&
                Number(val) <= POLICY_MAX_SIGNED_URL_BUCKET_SIZE),
            { message: `Must be between 1 and ${POLICY_MAX_SIGNED_URL_BUCKET_SIZE}` },
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
      maxFileSizeBytes: String(currentPolicy?.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE),
      allowedMimeTypesRaw:
        currentPolicy?.allowedMimeTypes?.join(", ") ?? "image/jpeg, image/png, image/webp",
      virusScanRequired: currentPolicy?.virusScanRequired ?? true,
      retentionDays: numToStr(currentPolicy?.retentionDays),
      retentionMode: currentPolicy?.retentionMode ?? "none",
      immutable: currentPolicy?.immutable ?? false,
      servingMode: currentPolicy?.servingMode ?? "signed",
      signedUrlTtlSeconds: numToStr(currentPolicy?.signedUrlTtlSeconds),
      signedUrlBucketSize: numToStr(currentPolicy?.signedUrlBucketSize),
      contentModerationRaw: jsonToRaw(currentPolicy?.contentModeration),
      requiredMetadataSchemaRaw: jsonToRaw(currentPolicy?.requiredMetadataSchema),
      retryConfigRaw: jsonToRaw(currentPolicy?.retryConfig),
    },
    mode: "onBlur",
  });

  // Reset form when the current policy loads
  useEffect(() => {
    if (currentPolicy) {
      form.reset({
        maxFileSizeBytes: String(currentPolicy.maxFileSizeBytes),
        allowedMimeTypesRaw: currentPolicy.allowedMimeTypes.join(", "),
        virusScanRequired: currentPolicy.virusScanRequired,
        retentionDays:
          currentPolicy.retentionDays !== null ? String(currentPolicy.retentionDays) : "",
        retentionMode: currentPolicy.retentionMode,
        immutable: currentPolicy.immutable,
        servingMode: currentPolicy.servingMode,
        signedUrlTtlSeconds:
          currentPolicy.signedUrlTtlSeconds !== null
            ? String(currentPolicy.signedUrlTtlSeconds)
            : "",
        signedUrlBucketSize:
          currentPolicy.signedUrlBucketSize !== null
            ? String(currentPolicy.signedUrlBucketSize)
            : "",
        contentModerationRaw: jsonToRaw(currentPolicy.contentModeration),
        requiredMetadataSchemaRaw: jsonToRaw(currentPolicy.requiredMetadataSchema),
        retryConfigRaw: jsonToRaw(currentPolicy.retryConfig),
      });
    }
  }, [currentPolicy, form]);

  const {
    handleSubmit,
    register,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = form;

  const isPending = updateMutation.isPending;
  const isBusy = isSubmitting || isPending;
  const formLevelError = errors.root?.message;

  function applyApiError(err: unknown): void {
    if (!(err instanceof ApiError)) {
      setError("root", {
        type: "generic",
        message: t("pages.namespaces.policy.edit.errors.generic"),
      });
      return;
    }

    const suffix = extractProblemTypeSuffix(err.body.type);
    const params = err.body.params ?? {};

    if (suffix === "namespace-not-found-error") {
      setError("root", {
        type: "not-found",
        message: t("pages.namespaces.policy.edit.errors.namespaceDeleted"),
      });
      return;
    }

    if (suffix === "namespace-archived-error") {
      setError("root", {
        type: "archived",
        message: t("pages.namespaces.policy.edit.errors.namespaceArchived"),
      });
      return;
    }

    if (suffix === "policy-version-conflict-error") {
      setError("root", {
        type: "conflict",
        message: t("pages.namespaces.policy.edit.errors.versionConflict"),
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
          message: err.body.detail ?? t("pages.namespaces.policy.edit.errors.generic"),
        });
      }
      return;
    }

    setError("root", {
      type: "generic",
      message: err.body.detail ?? t("pages.namespaces.policy.edit.errors.generic"),
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
      await updateMutation.mutateAsync({
        slug,
        input: {
          policy: {
            retentionDays,
            retentionMode: values.retentionMode,
            maxFileSizeBytes: Number(values.maxFileSizeBytes),
            allowedMimeTypes,
            virusScanRequired: values.virusScanRequired,
            contentModeration,
            requiredMetadataSchema,
            immutable: values.immutable,
            servingMode: values.servingMode,
            signedUrlTtlSeconds,
            signedUrlBucketSize,
            retryConfig,
          },
        },
      });
      await navigate({
        to: "/namespaces/$slug",
        params: { slug },
        search: { tab: "policy" },
      });
    } catch (err) {
      applyApiError(err);
    }
  }

  const isLoading = namespaceQuery.isLoading || policiesQuery.isLoading;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <p className="text-muted-foreground text-sm">{t("pages.namespaceDetail.loading")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      {/* Page header */}
      <div>
        <h1 className="text-[22px] font-bold tracking-tight">
          {t("pages.namespaces.policy.edit.title")}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("pages.namespaces.policy.edit.subtitle", { slug })}
        </p>
      </div>

      {/* Form-level error */}
      {formLevelError ? (
        <div
          id="edit-policy-form-error"
          role="alert"
          className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-4 py-3 text-sm"
        >
          {formLevelError}
        </div>
      ) : null}

      <form
        id="edit-policy-form"
        onSubmit={(e) => void handleSubmit(onSubmit)(e)}
        className="space-y-8"
        noValidate
      >
        {/* ── Section 1: Validation ─────────────────────────── */}
        <section aria-labelledby="section-validation">
          <SectionHeading>
            <span id="section-validation">{t("pages.namespaces.form.sections.validation")}</span>
          </SectionHeading>
          <div className="space-y-4">
            {/* Max file size */}
            <div className="grid gap-2">
              <FieldLabel htmlFor="ep-max-file-size">
                {t("pages.namespaces.form.fields.maxFileSizeBytes")}
              </FieldLabel>
              <TextInput
                id="ep-max-file-size"
                type="number"
                min={1}
                max={POLICY_MAX_FILE_SIZE_BYTES}
                aria-invalid={errors.maxFileSizeBytes ? true : undefined}
                aria-describedby={errors.maxFileSizeBytes ? "ep-max-file-size-error" : undefined}
                {...register("maxFileSizeBytes")}
              />
              {errors.maxFileSizeBytes?.message ? (
                <FieldMessage id="ep-max-file-size-error">
                  {errors.maxFileSizeBytes.message}
                </FieldMessage>
              ) : null}
            </div>

            {/* Allowed MIME types */}
            <div className="grid gap-2">
              <FieldLabel htmlFor="ep-allowed-mime-types">
                {t("pages.namespaces.form.fields.allowedMimeTypes")}
              </FieldLabel>
              <TextInput
                id="ep-allowed-mime-types"
                aria-invalid={errors.allowedMimeTypesRaw ? true : undefined}
                aria-describedby={
                  errors.allowedMimeTypesRaw
                    ? "ep-allowed-mime-types-error"
                    : "ep-allowed-mime-types-help"
                }
                {...register("allowedMimeTypesRaw")}
              />
              <FieldHelp id="ep-allowed-mime-types-help">
                {t("pages.namespaces.form.fields.allowedMimeTypesHelp")}
              </FieldHelp>
              {errors.allowedMimeTypesRaw?.message ? (
                <FieldMessage id="ep-allowed-mime-types-error">
                  {errors.allowedMimeTypesRaw.message}
                </FieldMessage>
              ) : null}
            </div>

            {/* Virus scan required */}
            <div className="flex items-center gap-3">
              <input
                id="ep-virus-scan"
                type="checkbox"
                className="h-4 w-4 rounded"
                aria-invalid={errors.virusScanRequired ? true : undefined}
                aria-describedby={errors.virusScanRequired ? "ep-virus-scan-error" : undefined}
                {...register("virusScanRequired")}
              />
              <FieldLabel htmlFor="ep-virus-scan">
                {t("pages.namespaces.form.fields.virusScanRequired")}
              </FieldLabel>
              {errors.virusScanRequired?.message ? (
                <FieldMessage id="ep-virus-scan-error">
                  {errors.virusScanRequired.message}
                </FieldMessage>
              ) : null}
            </div>
          </div>
        </section>

        {/* ── Section 2: Lifecycle ──────────────────────────── */}
        <section aria-labelledby="section-lifecycle">
          <SectionHeading>
            <span id="section-lifecycle">{t("pages.namespaces.form.sections.lifecycle")}</span>
          </SectionHeading>
          <div className="space-y-4">
            {/* Retention days */}
            <div className="grid gap-2">
              <FieldLabel htmlFor="ep-retention-days">
                {t("pages.namespaces.form.fields.retentionDays")}
              </FieldLabel>
              <TextInput
                id="ep-retention-days"
                type="number"
                min={1}
                max={POLICY_MAX_RETENTION_DAYS}
                placeholder="—"
                aria-invalid={errors.retentionDays ? true : undefined}
                aria-describedby={errors.retentionDays ? "ep-retention-days-error" : undefined}
                {...register("retentionDays")}
              />
              {errors.retentionDays?.message ? (
                <FieldMessage id="ep-retention-days-error">
                  {errors.retentionDays.message}
                </FieldMessage>
              ) : null}
            </div>

            {/* Retention mode */}
            <div className="grid gap-2">
              <FieldLabel htmlFor="ep-retention-mode">
                {t("pages.namespaces.form.fields.retentionMode")}
              </FieldLabel>
              <SelectInput
                id="ep-retention-mode"
                aria-invalid={errors.retentionMode ? true : undefined}
                aria-describedby={errors.retentionMode ? "ep-retention-mode-error" : undefined}
                {...register("retentionMode")}
              >
                <option value="delete">{t("pages.namespaces.form.retentionMode.delete")}</option>
                <option value="archive">{t("pages.namespaces.form.retentionMode.archive")}</option>
                <option value="none">{t("pages.namespaces.form.retentionMode.none")}</option>
              </SelectInput>
              {errors.retentionMode?.message ? (
                <FieldMessage id="ep-retention-mode-error">
                  {errors.retentionMode.message}
                </FieldMessage>
              ) : null}
            </div>

            {/* Immutable */}
            <div className="flex items-center gap-3">
              <input
                id="ep-immutable"
                type="checkbox"
                className="h-4 w-4 rounded"
                aria-invalid={errors.immutable ? true : undefined}
                aria-describedby={errors.immutable ? "ep-immutable-error" : undefined}
                {...register("immutable")}
              />
              <FieldLabel htmlFor="ep-immutable">
                {t("pages.namespaces.form.fields.immutable")}
              </FieldLabel>
              {errors.immutable?.message ? (
                <FieldMessage id="ep-immutable-error">{errors.immutable.message}</FieldMessage>
              ) : null}
            </div>
          </div>
        </section>

        {/* ── Section 3: Serving ────────────────────────────── */}
        <section aria-labelledby="section-serving">
          <SectionHeading>
            <span id="section-serving">{t("pages.namespaces.form.sections.serving")}</span>
          </SectionHeading>
          <div className="space-y-4">
            {/* Serving mode */}
            <div className="grid gap-2">
              <FieldLabel htmlFor="ep-serving-mode">
                {t("pages.namespaces.form.fields.servingMode")}
              </FieldLabel>
              <SelectInput
                id="ep-serving-mode"
                aria-invalid={errors.servingMode ? true : undefined}
                aria-describedby={errors.servingMode ? "ep-serving-mode-error" : undefined}
                {...register("servingMode")}
              >
                <option value="public">{t("pages.namespaces.form.servingMode.public")}</option>
                <option value="signed">{t("pages.namespaces.form.servingMode.signed")}</option>
                <option value="proxied">{t("pages.namespaces.form.servingMode.proxied")}</option>
              </SelectInput>
              {errors.servingMode?.message ? (
                <FieldMessage id="ep-serving-mode-error">{errors.servingMode.message}</FieldMessage>
              ) : null}
            </div>

            {/* Signed URL TTL */}
            <div className="grid gap-2">
              <FieldLabel htmlFor="ep-signed-url-ttl">
                {t("pages.namespaces.form.fields.signedUrlTtlSeconds")}
              </FieldLabel>
              <TextInput
                id="ep-signed-url-ttl"
                type="number"
                min={1}
                max={POLICY_MAX_TTL_SECONDS}
                aria-invalid={errors.signedUrlTtlSeconds ? true : undefined}
                aria-describedby={
                  errors.signedUrlTtlSeconds ? "ep-signed-url-ttl-error" : undefined
                }
                {...register("signedUrlTtlSeconds")}
              />
              {errors.signedUrlTtlSeconds?.message ? (
                <FieldMessage id="ep-signed-url-ttl-error">
                  {errors.signedUrlTtlSeconds.message}
                </FieldMessage>
              ) : null}
            </div>

            {/* Signed URL bucket size */}
            <div className="grid gap-2">
              <FieldLabel htmlFor="ep-signed-url-bucket-size">
                {t("pages.namespaces.form.fields.signedUrlBucketSize")}
              </FieldLabel>
              <TextInput
                id="ep-signed-url-bucket-size"
                type="number"
                min={1}
                max={POLICY_MAX_SIGNED_URL_BUCKET_SIZE}
                aria-invalid={errors.signedUrlBucketSize ? true : undefined}
                aria-describedby={
                  errors.signedUrlBucketSize ? "ep-signed-url-bucket-size-error" : undefined
                }
                {...register("signedUrlBucketSize")}
              />
              {errors.signedUrlBucketSize?.message ? (
                <FieldMessage id="ep-signed-url-bucket-size-error">
                  {errors.signedUrlBucketSize.message}
                </FieldMessage>
              ) : null}
            </div>
          </div>
        </section>

        {/* ── Section 4: Advanced ───────────────────────────── */}
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
              <FieldLabel htmlFor="ep-content-moderation">
                {t("pages.namespaces.form.fields.contentModeration")}
              </FieldLabel>
              <TextArea
                id="ep-content-moderation"
                rows={4}
                aria-invalid={errors.contentModerationRaw ? true : undefined}
                aria-describedby={
                  errors.contentModerationRaw ? "ep-content-moderation-error" : undefined
                }
                {...register("contentModerationRaw")}
              />
              {errors.contentModerationRaw?.message ? (
                <FieldMessage id="ep-content-moderation-error">
                  {errors.contentModerationRaw.message}
                </FieldMessage>
              ) : null}
            </div>

            {/* Required metadata schema */}
            <div className="grid gap-2">
              <FieldLabel htmlFor="ep-required-metadata-schema">
                {t("pages.namespaces.form.fields.requiredMetadataSchema")}
              </FieldLabel>
              <TextArea
                id="ep-required-metadata-schema"
                rows={4}
                aria-invalid={errors.requiredMetadataSchemaRaw ? true : undefined}
                aria-describedby={
                  errors.requiredMetadataSchemaRaw ? "ep-required-metadata-schema-error" : undefined
                }
                {...register("requiredMetadataSchemaRaw")}
              />
              {errors.requiredMetadataSchemaRaw?.message ? (
                <FieldMessage id="ep-required-metadata-schema-error">
                  {errors.requiredMetadataSchemaRaw.message}
                </FieldMessage>
              ) : null}
            </div>

            {/* Retry config */}
            <div className="grid gap-2">
              <FieldLabel htmlFor="ep-retry-config">
                {t("pages.namespaces.form.fields.retryConfig")}
              </FieldLabel>
              <TextArea
                id="ep-retry-config"
                rows={4}
                aria-invalid={errors.retryConfigRaw ? true : undefined}
                aria-describedby={errors.retryConfigRaw ? "ep-retry-config-error" : undefined}
                {...register("retryConfigRaw")}
              />
              {errors.retryConfigRaw?.message ? (
                <FieldMessage id="ep-retry-config-error">
                  {errors.retryConfigRaw.message}
                </FieldMessage>
              ) : null}
            </div>
          </div>
        </details>

        {/* ── Action bar ────────────────────────────────────── */}
        <div className="border-border/40 flex items-center justify-end gap-3 border-t pt-4">
          <Link to="/namespaces/$slug" params={{ slug }}>
            <Button type="button" variant="outline" disabled={isBusy}>
              {t("pages.namespaces.policy.edit.cancel")}
            </Button>
          </Link>
          <Button
            type="submit"
            form="edit-policy-form"
            variant="indigo"
            disabled={isBusy || !isDirty}
          >
            {t("pages.namespaces.policy.edit.submit")}
          </Button>
        </div>
      </form>
    </div>
  );
}
