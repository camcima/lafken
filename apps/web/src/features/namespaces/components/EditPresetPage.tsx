import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/common/Button";
import { PastPresetVersionsPanel } from "@/features/namespaces/components/PastPresetVersionsPanel";
import {
  useNamespace,
  useNamespacePresets,
  useUpdatePresetVersion,
} from "@/features/namespaces/hooks/useNamespaces";
import {
  PRESET_FITS,
  PRESET_FORMATS,
  updatePresetVersionSchema,
} from "@/features/namespaces/schemas/preset-params.schema";
import type { IUpdatePresetVersionValues } from "@/features/namespaces/schemas/preset-params.schema";
import { ApiError } from "@/lib/api/api-error";
import { extractProblemTypeSuffix } from "@/lib/api/problem-types";
import { cn } from "@/lib/utils";

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

// ── Constants ──────────────────────────────────────────────
const DEFAULT_QUALITY = 80;

// ── Helpers ────────────────────────────────────────────────
function toOptionalNum(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number") return value;
  return undefined;
}

function mapResponseParamsToFormValues(
  raw: Record<string, unknown>,
): IUpdatePresetVersionValues["params"] {
  return {
    fit: (raw["fit"] as IUpdatePresetVersionValues["params"]["fit"]) ?? "cover",
    format: (raw["format"] as IUpdatePresetVersionValues["params"]["format"]) ?? "auto",
    quality: typeof raw["quality"] === "number" ? raw["quality"] : DEFAULT_QUALITY,
    width: toOptionalNum(raw["width"]),
    height: toOptionalNum(raw["height"]),
    dpr: toOptionalNum(raw["dpr"]),
  };
}

// ── Main component ─────────────────────────────────────────
export function EditPresetPage(): React.JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { slug, name } = useParams({
    from: "/_protected/namespaces/$slug_/presets/$name_/edit",
  });

  const namespaceQuery = useNamespace(slug);
  const presetsQuery = useNamespacePresets(slug);

  const namespace = namespaceQuery.data;

  // Redirect to detail page if namespace is archived (defense-in-depth)
  useEffect(() => {
    if (namespace?.archivedAt) {
      void navigate({ to: "/namespaces/$slug", params: { slug }, search: { tab: "presets" } });
    }
  }, [namespace, navigate, slug]);

  // Find the latest version of the named preset
  const latestPreset = useMemo(() => {
    const presets = presetsQuery.data ?? [];
    const matching = presets.filter((preset) => preset.name === name);
    if (matching.length === 0) return undefined;
    return matching.reduce((best, curr) => (curr.version > best.version ? curr : best));
  }, [presetsQuery.data, name]);

  // If data loaded but preset not found, redirect to detail page
  const presetsLoaded = !presetsQuery.isLoading && presetsQuery.data !== undefined;
  useEffect(() => {
    if (presetsLoaded && !latestPreset) {
      void navigate({ to: "/namespaces/$slug", params: { slug }, search: { tab: "presets" } });
    }
  }, [presetsLoaded, latestPreset, navigate, slug]);

  // All versions of this preset (for the history panel)
  const presetVersions = useMemo(() => {
    const presets = presetsQuery.data ?? [];
    return presets.filter((preset) => preset.name === name).sort((a, b) => b.version - a.version);
  }, [presetsQuery.data, name]);

  const latestVersion = presetVersions[0]?.version ?? 1;
  const [selectedVersion, setSelectedVersion] = useState(latestVersion);

  // Reset selected version when latest changes (e.g. after a successful save)
  useEffect(() => {
    setSelectedVersion(latestVersion);
  }, [latestVersion]);

  const updateMutation = useUpdatePresetVersion();

  const form = useForm<IUpdatePresetVersionValues>({
    resolver: zodResolver(updatePresetVersionSchema),
    defaultValues: {
      params: mapResponseParamsToFormValues(latestPreset?.params ?? {}),
    },
    mode: "onBlur",
  });

  const { reset: resetForm } = form;

  // Re-populate when the preset loads
  useEffect(() => {
    if (latestPreset) {
      resetForm({ params: mapResponseParamsToFormValues(latestPreset.params) });
    }
  }, [latestPreset, resetForm]);

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
        message: t("pages.namespaces.presets.errors.generic"),
      });
      return;
    }

    const suffix = extractProblemTypeSuffix(err.body.type);

    if (suffix === "preset-not-found-error") {
      setError("root", {
        type: "not-found",
        message: t("pages.namespaces.presets.errors.presetNotFound"),
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

    if (suffix === "preset-version-conflict-error") {
      setError("root", {
        type: "conflict",
        message: t("pages.namespaces.presets.errors.versionConflict"),
      });
      return;
    }

    const params = err.body.params ?? {};
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
          // Map known params sub-paths
          if (path === "params.width") {
            setError("params.width", { type: "server", message });
            mappedAny = true;
          } else if (path === "params.height") {
            setError("params.height", { type: "server", message });
            mappedAny = true;
          } else if (path === "params.quality") {
            setError("params.quality", { type: "server", message });
            mappedAny = true;
          } else if (path === "params.fit") {
            setError("params.fit", { type: "server", message });
            mappedAny = true;
          } else if (path === "params.format") {
            setError("params.format", { type: "server", message });
            mappedAny = true;
          } else if (path === "params.dpr") {
            setError("params.dpr", { type: "server", message });
            mappedAny = true;
          }
        }
      }
      if (!mappedAny) {
        setError("root", {
          type: "generic",
          message: err.body.detail ?? t("pages.namespaces.presets.errors.generic"),
        });
      }
      return;
    }

    setError("root", {
      type: "generic",
      message: err.body.detail ?? t("pages.namespaces.presets.errors.generic"),
    });
  }

  async function onSubmit(values: IUpdatePresetVersionValues): Promise<void> {
    try {
      await updateMutation.mutateAsync({
        slug,
        name,
        input: {
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

  const isLoading = namespaceQuery.isLoading || presetsQuery.isLoading;

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
          {t("pages.namespaces.presets.edit.title")}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("pages.namespaces.presets.edit.subtitle", { slug, name })}
        </p>
      </div>

      {/* Form-level error */}
      {formLevelError ? (
        <div
          id="edit-preset-form-error"
          role="alert"
          className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-4 py-3 text-sm"
        >
          {formLevelError}
        </div>
      ) : null}

      <form
        id="edit-preset-form"
        onSubmit={(e) => void handleSubmit(onSubmit)(e)}
        className="space-y-8"
        noValidate
      >
        {/* ── Dimensions ────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4">
          {/* Width */}
          <div className="grid gap-2">
            <FieldLabel htmlFor="ep-width">{t("pages.namespaces.presets.form.width")}</FieldLabel>
            <TextInput
              id="ep-width"
              type="number"
              min={1}
              max={10000}
              aria-invalid={errors.params?.width ? true : undefined}
              aria-describedby={errors.params?.width ? "ep-width-error" : undefined}
              {...register("params.width", {
                setValueAs: (rawValue: string) => (rawValue === "" ? undefined : Number(rawValue)),
              })}
            />
            {errors.params?.width?.message ? (
              <FieldMessage id="ep-width-error">{errors.params.width.message}</FieldMessage>
            ) : null}
          </div>

          {/* Height */}
          <div className="grid gap-2">
            <FieldLabel htmlFor="ep-height">{t("pages.namespaces.presets.form.height")}</FieldLabel>
            <TextInput
              id="ep-height"
              type="number"
              min={1}
              max={10000}
              aria-invalid={errors.params?.height ? true : undefined}
              aria-describedby={errors.params?.height ? "ep-height-error" : undefined}
              {...register("params.height", {
                setValueAs: (rawValue: string) => (rawValue === "" ? undefined : Number(rawValue)),
              })}
            />
            {errors.params?.height?.message ? (
              <FieldMessage id="ep-height-error">{errors.params.height.message}</FieldMessage>
            ) : null}
          </div>
        </div>

        {/* ── Fit ───────────────────────────────────────────── */}
        <div className="grid gap-2">
          <FieldLabel htmlFor="ep-fit">{t("pages.namespaces.presets.form.fit")}</FieldLabel>
          <SelectInput
            id="ep-fit"
            aria-invalid={errors.params?.fit ? true : undefined}
            aria-describedby={errors.params?.fit ? "ep-fit-error" : undefined}
            {...register("params.fit")}
          >
            {PRESET_FITS.map((fit) => (
              <option key={fit} value={fit}>
                {fit}
              </option>
            ))}
          </SelectInput>
          {errors.params?.fit?.message ? (
            <FieldMessage id="ep-fit-error">{errors.params.fit.message}</FieldMessage>
          ) : null}
        </div>

        {/* ── Format ────────────────────────────────────────── */}
        <div className="grid gap-2">
          <FieldLabel htmlFor="ep-format">{t("pages.namespaces.presets.form.format")}</FieldLabel>
          <SelectInput
            id="ep-format"
            aria-invalid={errors.params?.format ? true : undefined}
            aria-describedby={errors.params?.format ? "ep-format-error" : undefined}
            {...register("params.format")}
          >
            {PRESET_FORMATS.map((format) => (
              <option key={format} value={format}>
                {format}
              </option>
            ))}
          </SelectInput>
          {errors.params?.format?.message ? (
            <FieldMessage id="ep-format-error">{errors.params.format.message}</FieldMessage>
          ) : null}
        </div>

        {/* ── Quality ───────────────────────────────────────── */}
        <div className="grid gap-2">
          <FieldLabel htmlFor="ep-quality">{t("pages.namespaces.presets.form.quality")}</FieldLabel>
          <TextInput
            id="ep-quality"
            type="number"
            min={1}
            max={100}
            aria-invalid={errors.params?.quality ? true : undefined}
            aria-describedby={errors.params?.quality ? "ep-quality-error" : undefined}
            {...register("params.quality", { valueAsNumber: true })}
          />
          {errors.params?.quality?.message ? (
            <FieldMessage id="ep-quality-error">{errors.params.quality.message}</FieldMessage>
          ) : null}
        </div>

        {/* ── DPR ───────────────────────────────────────────── */}
        <div className="grid gap-2">
          <FieldLabel htmlFor="ep-dpr">{t("pages.namespaces.presets.form.dpr")}</FieldLabel>
          <TextInput
            id="ep-dpr"
            type="number"
            min={0.5}
            max={4}
            step={0.5}
            aria-invalid={errors.params?.dpr ? true : undefined}
            aria-describedby={errors.params?.dpr ? "ep-dpr-error" : undefined}
            {...register("params.dpr", {
              setValueAs: (rawValue: string) => (rawValue === "" ? undefined : Number(rawValue)),
            })}
          />
          {errors.params?.dpr?.message ? (
            <FieldMessage id="ep-dpr-error">{errors.params.dpr.message}</FieldMessage>
          ) : null}
        </div>

        {/* ── Action bar ────────────────────────────────────── */}
        <div className="border-border/40 flex items-center justify-end gap-3 border-t pt-4">
          <Link to="/namespaces/$slug" params={{ slug }} search={{ tab: "presets" }}>
            <Button type="button" variant="outline" disabled={isBusy}>
              {t("pages.namespaces.presets.edit.cancel")}
            </Button>
          </Link>
          <Button
            type="submit"
            form="edit-preset-form"
            variant="indigo"
            disabled={isBusy || !isDirty}
          >
            {t("pages.namespaces.presets.edit.submit")}
          </Button>
        </div>
      </form>

      {/* Past versions panel (read-only history) */}
      {presetVersions.length > 0 && (
        <PastPresetVersionsPanel
          presets={presetVersions}
          selectedVersion={selectedVersion}
          onSelectVersion={setSelectedVersion}
        />
      )}
    </div>
  );
}
