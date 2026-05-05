import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/common/Button";
import { useCreatePreset, useNamespace } from "@/features/namespaces/hooks/useNamespaces";
import {
  createPresetSchema,
  PRESET_FITS,
  PRESET_FORMATS,
} from "@/features/namespaces/schemas/preset-params.schema";
import type { ICreatePresetValues } from "@/features/namespaces/schemas/preset-params.schema";
import { ApiError } from "@/lib/api/api-error";
import { extractProblemTypeSuffix } from "@/lib/api/problem-types";
import { cn } from "@/lib/utils";

// ── Constants ──────────────────────────────────────────────
const DEFAULT_QUALITY = 80;

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

// ── Main component ─────────────────────────────────────────
export function NewPresetPage(): React.JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { slug } = useParams({ from: "/_protected/namespaces/$slug_/presets/new" });

  const namespaceQuery = useNamespace(slug);
  const namespace = namespaceQuery.data;

  // Redirect to detail page if namespace is archived (defense-in-depth)
  useEffect(() => {
    if (namespace?.archivedAt) {
      void navigate({ to: "/namespaces/$slug", params: { slug }, search: { tab: "presets" } });
    }
  }, [namespace, navigate, slug]);

  const createPreset = useCreatePreset();

  const form = useForm<ICreatePresetValues>({
    resolver: zodResolver(createPresetSchema),
    defaultValues: {
      name: "",
      params: {
        fit: "cover",
        format: "auto",
        quality: DEFAULT_QUALITY,
        width: undefined,
        height: undefined,
        dpr: undefined,
      },
    },
    mode: "onBlur",
  });

  const {
    handleSubmit,
    register,
    setError,
    formState: { errors, isSubmitting },
  } = form;

  const isPending = createPreset.isPending;
  const isBusy = isSubmitting || isPending;
  const formLevelError = errors.root?.message;

  function applyApiError(err: unknown): void {
    if (!(err instanceof ApiError)) {
      setError("root", {
        type: "generic",
        message: t("pages.namespaces.presets.errors.generic"),
      });
      return;
    }

    const suffix = extractProblemTypeSuffix(err.body.type);

    if (suffix === "preset-name-already-exists-error") {
      setError("name", {
        type: "server",
        message: t("pages.namespaces.presets.errors.duplicateName"),
      });
      return;
    }

    if (suffix === "namespace-archived-error") {
      setError("root", {
        type: "archived",
        message: t("pages.namespaces.errors.namespaceArchived"),
      });
      return;
    }

    if (suffix === "namespace-not-found-error") {
      setError("root", {
        type: "not-found",
        message: t("pages.namespaces.errors.namespaceDeleted"),
      });
      return;
    }

    setError("root", {
      type: "generic",
      message: err.body.detail ?? t("pages.namespaces.presets.errors.generic"),
    });
  }

  async function onSubmit(values: ICreatePresetValues): Promise<void> {
    try {
      await createPreset.mutateAsync({
        slug,
        input: {
          name: values.name,
          params: {
            fit: values.params.fit,
            format: values.params.format,
            quality: values.params.quality,
            width: values.params.width ?? null,
            height: values.params.height ?? null,
            dpr: values.params.dpr ?? null,
          },
        },
      });
      await navigate({
        to: "/namespaces/$slug",
        params: { slug },
        search: { tab: "presets" },
      });
    } catch (err) {
      applyApiError(err);
    }
  }

  const isLoading = namespaceQuery.isLoading;

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
          {t("pages.namespaces.presets.new.title")}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("pages.namespaces.presets.new.subtitle", { slug })}
        </p>
      </div>

      {/* Form-level error */}
      {formLevelError ? (
        <div
          id="new-preset-form-error"
          role="alert"
          className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-4 py-3 text-sm"
        >
          {formLevelError}
        </div>
      ) : null}

      <form
        id="new-preset-form"
        onSubmit={(e) => void handleSubmit(onSubmit)(e)}
        className="space-y-8"
        noValidate
      >
        {/* ── Preset name ───────────────────────────────────── */}
        <div className="grid gap-2">
          <FieldLabel htmlFor="np-name">{t("pages.namespaces.presets.form.name")}</FieldLabel>
          <TextInput
            id="np-name"
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? "np-name-error" : "np-name-help"}
            {...register("name")}
          />
          <p id="np-name-help" className="text-muted-foreground mt-1 text-xs">
            {t("pages.namespaces.presets.form.nameHelp")}
          </p>
          {errors.name?.message ? (
            <FieldMessage id="np-name-error">{errors.name.message}</FieldMessage>
          ) : null}
        </div>

        {/* ── Dimensions ────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4">
          {/* Width */}
          <div className="grid gap-2">
            <FieldLabel htmlFor="np-width">{t("pages.namespaces.presets.form.width")}</FieldLabel>
            <TextInput
              id="np-width"
              type="number"
              min={1}
              max={10000}
              aria-invalid={errors.params?.width ? true : undefined}
              aria-describedby={errors.params?.width ? "np-width-error" : undefined}
              {...register("params.width", {
                setValueAs: (rawValue: string) => (rawValue === "" ? undefined : Number(rawValue)),
              })}
            />
            {errors.params?.width?.message ? (
              <FieldMessage id="np-width-error">{errors.params.width.message}</FieldMessage>
            ) : null}
          </div>

          {/* Height */}
          <div className="grid gap-2">
            <FieldLabel htmlFor="np-height">{t("pages.namespaces.presets.form.height")}</FieldLabel>
            <TextInput
              id="np-height"
              type="number"
              min={1}
              max={10000}
              aria-invalid={errors.params?.height ? true : undefined}
              aria-describedby={errors.params?.height ? "np-height-error" : undefined}
              {...register("params.height", {
                setValueAs: (rawValue: string) => (rawValue === "" ? undefined : Number(rawValue)),
              })}
            />
            {errors.params?.height?.message ? (
              <FieldMessage id="np-height-error">{errors.params.height.message}</FieldMessage>
            ) : null}
          </div>
        </div>

        {/* ── Fit ───────────────────────────────────────────── */}
        <div className="grid gap-2">
          <FieldLabel htmlFor="np-fit">{t("pages.namespaces.presets.form.fit")}</FieldLabel>
          <SelectInput
            id="np-fit"
            aria-invalid={errors.params?.fit ? true : undefined}
            aria-describedby={errors.params?.fit ? "np-fit-error" : undefined}
            {...register("params.fit")}
          >
            {PRESET_FITS.map((fit) => (
              <option key={fit} value={fit}>
                {fit}
              </option>
            ))}
          </SelectInput>
          {errors.params?.fit?.message ? (
            <FieldMessage id="np-fit-error">{errors.params.fit.message}</FieldMessage>
          ) : null}
        </div>

        {/* ── Format ────────────────────────────────────────── */}
        <div className="grid gap-2">
          <FieldLabel htmlFor="np-format">{t("pages.namespaces.presets.form.format")}</FieldLabel>
          <SelectInput
            id="np-format"
            aria-invalid={errors.params?.format ? true : undefined}
            aria-describedby={errors.params?.format ? "np-format-error" : undefined}
            {...register("params.format")}
          >
            {PRESET_FORMATS.map((format) => (
              <option key={format} value={format}>
                {format}
              </option>
            ))}
          </SelectInput>
          {errors.params?.format?.message ? (
            <FieldMessage id="np-format-error">{errors.params.format.message}</FieldMessage>
          ) : null}
        </div>

        {/* ── Quality ───────────────────────────────────────── */}
        <div className="grid gap-2">
          <FieldLabel htmlFor="np-quality">{t("pages.namespaces.presets.form.quality")}</FieldLabel>
          <TextInput
            id="np-quality"
            type="number"
            min={1}
            max={100}
            aria-invalid={errors.params?.quality ? true : undefined}
            aria-describedby={errors.params?.quality ? "np-quality-error" : undefined}
            {...register("params.quality", { valueAsNumber: true })}
          />
          {errors.params?.quality?.message ? (
            <FieldMessage id="np-quality-error">{errors.params.quality.message}</FieldMessage>
          ) : null}
        </div>

        {/* ── DPR ───────────────────────────────────────────── */}
        <div className="grid gap-2">
          <FieldLabel htmlFor="np-dpr">{t("pages.namespaces.presets.form.dpr")}</FieldLabel>
          <TextInput
            id="np-dpr"
            type="number"
            min={0.5}
            max={4}
            step={0.5}
            aria-invalid={errors.params?.dpr ? true : undefined}
            aria-describedby={errors.params?.dpr ? "np-dpr-error" : undefined}
            {...register("params.dpr", {
              setValueAs: (rawValue: string) => (rawValue === "" ? undefined : Number(rawValue)),
            })}
          />
          {errors.params?.dpr?.message ? (
            <FieldMessage id="np-dpr-error">{errors.params.dpr.message}</FieldMessage>
          ) : null}
        </div>

        {/* ── Action bar ────────────────────────────────────── */}
        <div className="border-border/40 flex items-center justify-end gap-3 border-t pt-4">
          <Link to="/namespaces/$slug" params={{ slug }} search={{ tab: "presets" }}>
            <Button type="button" variant="outline" disabled={isBusy}>
              {t("pages.namespaces.presets.new.cancel")}
            </Button>
          </Link>
          <Button type="submit" form="new-preset-form" variant="indigo" disabled={isBusy}>
            {t("pages.namespaces.presets.new.submit")}
          </Button>
        </div>
      </form>
    </div>
  );
}
