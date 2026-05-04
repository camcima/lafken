import { zodResolver } from "@hookform/resolvers/zod";
import type { StorageBindingResponseDTO } from "@shared/backend-api";
import React, { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { Button } from "@/components/common/Button";
import { RightDrawer } from "@/components/common/RightDrawer";
import {
  useCreateStorageBinding,
  useUpdateStorageBinding,
} from "@/features/system/hooks/useSystem";
import { ApiError } from "@/lib/api/api-error";
import { cn } from "@/lib/utils";

// ── Constants ─────────────────────────────────────────────
const NAME_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;
const BUCKET_PATTERN = /^[a-z0-9][a-z0-9._-]*[a-z0-9]$/;
const BUCKET_MIN_LENGTH = 3;
const BUCKET_MAX_LENGTH = 63;
const PROJECT_ID_MIN_LENGTH = 6;
const PROJECT_ID_MAX_LENGTH = 30;
const PREFIX_MAX_LENGTH = 255;
const PROBLEM_TYPE_PREFIX = "https://lafken.dev/problems/";

interface FormValues {
  name: string;
  adapterType: "gcs";
  bucket: string;
  projectId: string;
  prefix?: string;
}
type FormFieldName = keyof FormValues;

interface IStorageBindingDrawerProps {
  open: boolean;
  mode: "create" | "edit";
  binding?: StorageBindingResponseDTO;
  onClose: () => void;
}

// Sub-components for label/input/message — mirrors DashboardForm style.
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

function getEmptyValues(): FormValues {
  return {
    name: "",
    adapterType: "gcs",
    bucket: "",
    projectId: "",
    prefix: "",
  };
}

function getValuesFromBinding(binding: StorageBindingResponseDTO): FormValues {
  const config: Record<string, unknown> = binding.config ?? {};
  const bucket = typeof config.bucket === "string" ? config.bucket : "";
  const projectId = typeof config.projectId === "string" ? config.projectId : "";
  const prefix = typeof config.prefix === "string" ? config.prefix : "";
  return {
    name: binding.name,
    adapterType: "gcs",
    bucket,
    projectId,
    prefix,
  };
}

function extractErrorTypeSuffix(body: { type?: string }): string | undefined {
  if (!body.type || !body.type.startsWith(PROBLEM_TYPE_PREFIX)) return undefined;
  return body.type.slice(PROBLEM_TYPE_PREFIX.length);
}

export function StorageBindingDrawer({
  open,
  mode,
  binding,
  onClose,
}: IStorageBindingDrawerProps): React.JSX.Element {
  const { t } = useTranslation();

  const createMutation = useCreateStorageBinding();
  const updateMutation = useUpdateStorageBinding();

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().regex(NAME_PATTERN, {
          message: t("pages.system.storageBindings.errors.invalidName"),
        }),
        adapterType: z.literal("gcs"),
        bucket: z
          .string()
          .min(BUCKET_MIN_LENGTH, {
            message: t("pages.system.storageBindings.errors.invalidBucket"),
          })
          .max(BUCKET_MAX_LENGTH, {
            message: t("pages.system.storageBindings.errors.invalidBucket"),
          })
          .regex(BUCKET_PATTERN, {
            message: t("pages.system.storageBindings.errors.invalidBucket"),
          }),
        projectId: z
          .string()
          .min(PROJECT_ID_MIN_LENGTH, {
            message: t("pages.system.storageBindings.errors.invalidProjectId"),
          })
          .max(PROJECT_ID_MAX_LENGTH, {
            message: t("pages.system.storageBindings.errors.invalidProjectId"),
          }),
        prefix: z
          .string()
          .max(PREFIX_MAX_LENGTH, {
            message: t("pages.system.storageBindings.errors.invalidPrefix"),
          })
          .optional(),
      }),
    [t],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: getEmptyValues(),
    mode: "onBlur",
  });

  const {
    handleSubmit,
    register,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = form;

  // Sync form state when drawer opens or the editing target changes.
  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && binding) {
      reset(getValuesFromBinding(binding));
    } else {
      reset(getEmptyValues());
    }
  }, [open, mode, binding, reset]);

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isBusy = isSubmitting || isPending;
  const formLevelError = errors.root?.message;

  function applyApiError(err: unknown, currentBucket: string): void {
    if (!(err instanceof ApiError)) {
      setError("root", {
        type: "server",
        message: t("pages.system.storageBindings.errors.generic"),
      });
      return;
    }
    const suffix = extractErrorTypeSuffix(err.body);
    const params = err.body.params ?? {};

    if (suffix === "bucket-not-found-error") {
      const bucketParam = typeof params.bucket === "string" ? params.bucket : currentBucket;
      setError("root", {
        type: "server",
        message: t("pages.system.storageBindings.errors.bucketNotFound", { bucket: bucketParam }),
      });
      return;
    }

    if (suffix === "duplicate-storage-binding-name-error") {
      setError("name", {
        type: "manual",
        message: t("pages.system.storageBindings.errors.duplicateName"),
      });
      return;
    }

    if (suffix === "invalid-storage-binding-config-error") {
      const violations = Array.isArray(params.violations) ? params.violations : [];
      const formFields: readonly FormFieldName[] = [
        "name",
        "adapterType",
        "bucket",
        "projectId",
        "prefix",
      ];
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
          const field = formFields.find((name) => name === path);
          if (field) {
            setError(field, { type: "server", message });
            mappedAny = true;
          }
        }
      }
      if (!mappedAny) {
        setError("root", {
          type: "server",
          message: t("pages.system.storageBindings.errors.validationFailed"),
        });
      }
      return;
    }

    setError("root", {
      type: "server",
      message: err.body.detail ?? t("pages.system.storageBindings.errors.generic"),
    });
  }

  async function onSubmit(values: FormValues): Promise<void> {
    const config: Record<string, unknown> = {
      bucket: values.bucket,
      projectId: values.projectId,
    };
    if (values.prefix && values.prefix.length > 0) {
      config.prefix = values.prefix;
    }

    try {
      if (mode === "create") {
        await createMutation.mutateAsync({
          name: values.name,
          adapterType: "gcs",
          config,
        });
      } else if (binding) {
        await updateMutation.mutateAsync({
          name: binding.name,
          input: { config },
        });
      } else {
        return;
      }
      reset(getEmptyValues());
      onClose();
    } catch (err) {
      applyApiError(err, values.bucket);
    }
  }

  const title =
    mode === "create"
      ? t("pages.system.storageBindings.form.createTitle")
      : t("pages.system.storageBindings.form.editTitle");

  return (
    <RightDrawer
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={isBusy}>
            {t("pages.system.storageBindings.form.cancel")}
          </Button>
          <Button type="submit" form="storage-binding-form" disabled={isBusy} variant="indigo">
            {t("pages.system.storageBindings.form.submit")}
          </Button>
        </>
      }
    >
      <form
        id="storage-binding-form"
        onSubmit={(e) => void handleSubmit(onSubmit)(e)}
        className="space-y-4 px-5 py-4"
      >
        <div className="grid gap-2">
          <FieldLabel htmlFor="storage-binding-name">
            {t("pages.system.storageBindings.form.name")}
          </FieldLabel>
          <TextInput
            id="storage-binding-name"
            disabled={mode === "edit"}
            readOnly={mode === "edit"}
            aria-readonly={mode === "edit"}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={
              errors.name ? "storage-binding-name-error" : "storage-binding-name-help"
            }
            {...register("name")}
          />
          <FieldHelp id="storage-binding-name-help">
            {t("pages.system.storageBindings.form.nameHelp")}
          </FieldHelp>
          {errors.name?.message ? (
            <FieldMessage id="storage-binding-name-error">{errors.name.message}</FieldMessage>
          ) : null}
        </div>

        <div className="grid gap-2">
          <FieldLabel htmlFor="storage-binding-adapter">
            {t("pages.system.storageBindings.form.adapterType")}
          </FieldLabel>
          <TextInput
            id="storage-binding-adapter"
            value="GCS"
            disabled
            readOnly
            aria-readonly="true"
            aria-invalid={false}
            aria-describedby={
              errors.adapterType?.message ? "storage-binding-adapter-error" : undefined
            }
          />
          {errors.adapterType?.message ? (
            <FieldMessage id="storage-binding-adapter-error">
              {errors.adapterType.message}
            </FieldMessage>
          ) : null}
        </div>

        <div className="grid gap-2">
          <FieldLabel htmlFor="storage-binding-bucket">
            {t("pages.system.storageBindings.form.bucket")}
          </FieldLabel>
          <TextInput
            id="storage-binding-bucket"
            aria-invalid={errors.bucket ? true : undefined}
            aria-describedby={
              errors.bucket ? "storage-binding-bucket-error" : "storage-binding-bucket-help"
            }
            {...register("bucket")}
          />
          <FieldHelp id="storage-binding-bucket-help">
            {t("pages.system.storageBindings.form.bucketHelp")}
          </FieldHelp>
          {errors.bucket?.message ? (
            <FieldMessage id="storage-binding-bucket-error">{errors.bucket.message}</FieldMessage>
          ) : null}
        </div>

        <div className="grid gap-2">
          <FieldLabel htmlFor="storage-binding-project-id">
            {t("pages.system.storageBindings.form.projectId")}
          </FieldLabel>
          <TextInput
            id="storage-binding-project-id"
            aria-invalid={errors.projectId ? true : undefined}
            aria-describedby={errors.projectId ? "storage-binding-project-id-error" : undefined}
            {...register("projectId")}
          />
          {errors.projectId?.message ? (
            <FieldMessage id="storage-binding-project-id-error">
              {errors.projectId.message}
            </FieldMessage>
          ) : null}
        </div>

        <div className="grid gap-2">
          <FieldLabel htmlFor="storage-binding-prefix">
            {t("pages.system.storageBindings.form.prefix")}
          </FieldLabel>
          <TextInput
            id="storage-binding-prefix"
            aria-invalid={errors.prefix ? true : undefined}
            aria-describedby={errors.prefix ? "storage-binding-prefix-error" : undefined}
            {...register("prefix")}
          />
          {errors.prefix?.message ? (
            <FieldMessage id="storage-binding-prefix-error">{errors.prefix.message}</FieldMessage>
          ) : null}
        </div>

        {formLevelError ? (
          <div
            id="storage-binding-form-error"
            role="alert"
            className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm"
          >
            {formLevelError}
          </div>
        ) : null}
      </form>
    </RightDrawer>
  );
}
