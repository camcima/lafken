import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/common/Button";
import { PastPresetVersionsPanel } from "@/features/namespaces/components/PastPresetVersionsPanel";
import {
  PresetNumberedSection,
  PresetParamsFields,
  PresetPreviewRail,
} from "@/features/namespaces/components/PresetFormShared";
import {
  useNamespace,
  useNamespacePresets,
  useUpdatePresetVersion,
} from "@/features/namespaces/hooks/useNamespaces";
import { updatePresetVersionSchema } from "@/features/namespaces/schemas/preset-params.schema";
import type { IUpdatePresetVersionValues } from "@/features/namespaces/schemas/preset-params.schema";
import { ApiError } from "@/lib/api/api-error";
import { extractProblemTypeSuffix } from "@/lib/api/problem-types";

const DEFAULT_QUALITY = 80;
const BACK_ICON_SIZE = 14;

function toOptionalNum(value: unknown): number | undefined {
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

export function EditPresetPage(): React.JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { slug, name } = useParams({
    from: "/_protected/namespaces/$slug_/presets/$name_/edit",
  });

  const namespaceQuery = useNamespace(slug);
  const presetsQuery = useNamespacePresets(slug);
  const namespace = namespaceQuery.data;

  useEffect(() => {
    if (namespace?.archivedAt) {
      void navigate({ to: "/namespaces/$slug", params: { slug }, search: { tab: "presets" } });
    }
  }, [namespace, navigate, slug]);

  const latestPreset = useMemo(() => {
    const presets = presetsQuery.data ?? [];
    const matching = presets.filter((preset) => preset.name === name);
    if (matching.length === 0) return undefined;
    return matching.reduce((best, curr) => (curr.version > best.version ? curr : best));
  }, [presetsQuery.data, name]);

  const presetsLoaded = !presetsQuery.isLoading && presetsQuery.data !== undefined;
  useEffect(() => {
    if (presetsLoaded && !latestPreset) {
      void navigate({ to: "/namespaces/$slug", params: { slug }, search: { tab: "presets" } });
    }
  }, [presetsLoaded, latestPreset, navigate, slug]);

  const presetVersions = useMemo(() => {
    const presets = presetsQuery.data ?? [];
    return presets.filter((preset) => preset.name === name).sort((a, b) => b.version - a.version);
  }, [presetsQuery.data, name]);

  const latestVersion = presetVersions[0]?.version ?? 1;
  const [selectedVersion, setSelectedVersion] = useState(latestVersion);

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

  useEffect(() => {
    if (latestPreset) {
      resetForm({ params: mapResponseParamsToFormValues(latestPreset.params) });
    }
  }, [latestPreset, resetForm]);

  const {
    control,
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
      <div className="mx-auto max-w-7xl px-4 py-6">
        <p className="text-muted-foreground text-sm">{t("pages.namespaceDetail.loading")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <div>
        <Link
          to="/namespaces/$slug"
          params={{ slug }}
          search={{ tab: "presets" }}
          className="text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1.5 text-[12px]"
        >
          <ArrowLeft size={BACK_ICON_SIZE} />
          {t("pages.namespaceDetail.backToNamespaces")}
        </Link>
        <h1 className="text-[22px] font-bold tracking-tight">
          {t("pages.namespaces.presets.edit.title")}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("pages.namespaces.presets.edit.subtitle", { slug, name })}
        </p>
      </div>

      {formLevelError ? (
        <div
          id="edit-preset-form-error"
          role="alert"
          className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-4 py-3 text-sm"
        >
          {formLevelError}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <form
          id="edit-preset-form"
          onSubmit={(e) => void handleSubmit(onSubmit)(e)}
          className="space-y-4"
          noValidate
        >
          <PresetNumberedSection
            num={1}
            labelledBy="ep-section-identity"
            title={t("pages.namespaces.presets.form.sections.identity")}
            hint={t("pages.namespaces.presets.form.sections.identityHint")}
          >
            <div className="grid gap-2">
              <span id="ep-name-label" className="text-foreground text-[11.5px] font-medium">
                {t("pages.namespaces.presets.form.name")}
              </span>
              <div
                aria-labelledby="ep-name-label"
                className="border-input bg-secondary/40 text-muted-foreground flex h-9 items-center overflow-hidden rounded-md border"
              >
                <span className="border-border bg-secondary/60 border-r px-3 py-1 font-mono text-[12px] select-none">
                  {slug}/&lt;id&gt;@
                </span>
                <span className="text-foreground flex-1 px-3 font-mono text-[12.5px]">{name}</span>
              </div>
              <p className="text-muted-foreground mt-1 text-[10.5px]">
                {t("pages.namespaces.presets.form.editNameLocked")}
              </p>
            </div>
          </PresetNumberedSection>

          <PresetParamsFields<IUpdatePresetVersionValues>
            register={register}
            errors={errors}
            idPrefix="ep"
          />

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

        <PresetPreviewRail<IUpdatePresetVersionValues>
          control={control}
          slug={slug}
          presetName={name}
        />
      </div>

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
