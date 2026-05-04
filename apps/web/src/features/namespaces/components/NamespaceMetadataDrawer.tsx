import { zodResolver } from "@hookform/resolvers/zod";
import type { NamespaceResponseDTO } from "@shared/backend-api";
import React, { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { Button } from "@/components/common/Button";
import { RightDrawer } from "@/components/common/RightDrawer";
import { useUpdateNamespaceMetadata } from "@/features/namespaces/hooks/useNamespaces";
import { ApiError } from "@/lib/api/api-error";
import { cn } from "@/lib/utils";

// ── Constants ─────────────────────────────────────────────
const DISPLAY_NAME_MAX = 200;
const DESCRIPTION_MAX = 2000;
const PROBLEM_TYPE_PREFIX = "https://lafken.dev/problems/";
const HTTP_BAD_REQUEST = 400;

interface INamespaceMetadataDrawerProps {
  open: boolean;
  namespace?: NamespaceResponseDTO;
  onClose: () => void;
}

// ── Field sub-components ──────────────────────────────────

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
        "border-input bg-background flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm",
        "ring-offset-background placeholder:text-muted-foreground",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        "resize-none disabled:cursor-not-allowed disabled:opacity-50",
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

function extractErrorTypeSuffix(body: { type?: string }): string | undefined {
  if (!body.type || !body.type.startsWith(PROBLEM_TYPE_PREFIX)) return undefined;
  return body.type.slice(PROBLEM_TYPE_PREFIX.length);
}

// ── Form schema ───────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const baseSchema = z.object({
  displayName: z.string().min(1).max(DISPLAY_NAME_MAX),
  description: z.string().max(DESCRIPTION_MAX).optional(),
});

type FormValues = z.infer<typeof baseSchema>;

// ── Component ─────────────────────────────────────────────

export function NamespaceMetadataDrawer({
  open,
  namespace,
  onClose,
}: INamespaceMetadataDrawerProps): React.JSX.Element {
  const { t } = useTranslation();

  const updateMutation = useUpdateNamespaceMetadata();

  const resolverSchema = useMemo(
    () =>
      z.object({
        displayName: z
          .string()
          .min(1, { message: t("pages.namespaces.errors.displayNameRequired") })
          .max(DISPLAY_NAME_MAX, { message: t("pages.namespaces.errors.displayNameTooLong") }),
        description: z
          .string()
          .max(DESCRIPTION_MAX, { message: t("pages.namespaces.errors.descriptionTooLong") })
          .optional(),
      }),
    [t],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(resolverSchema),
    defaultValues: { displayName: "", description: "" },
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
    if (namespace) {
      reset({
        displayName: namespace.displayName,
        description: namespace.description ?? "",
      });
    } else {
      reset({ displayName: "", description: "" });
    }
  }, [open, namespace, reset]);

  const isBusy = isSubmitting || updateMutation.isPending;
  const formLevelError = errors.root?.message;

  function applyApiError(err: unknown): void {
    if (!(err instanceof ApiError)) {
      setError("root", {
        type: "server",
        message: t("pages.namespaces.errors.generic"),
      });
      return;
    }

    const suffix = extractErrorTypeSuffix(err.body);

    if (suffix === "namespace-not-found-error") {
      setError("root", {
        type: "server",
        message: t("pages.namespaces.errors.namespaceDeleted"),
      });
      return;
    }

    if (err.status === HTTP_BAD_REQUEST) {
      const params = err.body.params ?? {};
      const violations = Array.isArray(params.violations) ? params.violations : [];
      const formFields: ReadonlyArray<keyof FormValues> = ["displayName", "description"];
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
          message: t("pages.namespaces.errors.generic"),
        });
      }
      return;
    }

    setError("root", {
      type: "server",
      message: err.body.detail ?? t("pages.namespaces.errors.generic"),
    });
  }

  async function onSubmit(values: FormValues): Promise<void> {
    if (!namespace) return;
    try {
      await updateMutation.mutateAsync({
        slug: namespace.slug,
        input: {
          displayName: values.displayName,
          description: values.description?.trim() || null,
        },
      });
      onClose();
    } catch (err) {
      applyApiError(err);
    }
  }

  return (
    <RightDrawer
      open={open}
      onClose={onClose}
      title={t("pages.namespaces.edit.title")}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={isBusy}>
            {t("pages.namespaces.edit.cancel")}
          </Button>
          <Button type="submit" form="namespace-metadata-form" disabled={isBusy} variant="indigo">
            {t("pages.namespaces.edit.submit")}
          </Button>
        </>
      }
    >
      <form
        id="namespace-metadata-form"
        onSubmit={(e) => void handleSubmit(onSubmit)(e)}
        className="space-y-4 px-5 py-4"
      >
        <div className="grid gap-2">
          <FieldLabel htmlFor="namespace-display-name">
            {t("pages.namespaces.form.fields.displayName")}
          </FieldLabel>
          <TextInput
            id="namespace-display-name"
            aria-invalid={errors.displayName ? true : undefined}
            aria-describedby={errors.displayName ? "namespace-display-name-error" : undefined}
            {...register("displayName")}
          />
          {errors.displayName?.message ? (
            <FieldMessage id="namespace-display-name-error">
              {errors.displayName.message}
            </FieldMessage>
          ) : null}
        </div>

        <div className="grid gap-2">
          <FieldLabel htmlFor="namespace-description">
            {t("pages.namespaces.form.fields.description")}
          </FieldLabel>
          <TextArea
            id="namespace-description"
            rows={4}
            aria-invalid={errors.description ? true : undefined}
            aria-describedby={errors.description ? "namespace-description-error" : undefined}
            {...register("description")}
          />
          {errors.description?.message ? (
            <FieldMessage id="namespace-description-error">
              {errors.description.message}
            </FieldMessage>
          ) : null}
        </div>

        {formLevelError ? (
          <div
            id="namespace-metadata-form-error"
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
