import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import React, { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/common/Button";
import {
  PresetNumberedSection,
  PresetParamsFields,
  PresetPreviewRail,
} from "@/features/namespaces/components/PresetFormShared";
import { useCreatePreset, useNamespace } from "@/features/namespaces/hooks/useNamespaces";
import { createPresetSchema } from "@/features/namespaces/schemas/preset-params.schema";
import type { ICreatePresetValues } from "@/features/namespaces/schemas/preset-params.schema";
import { ApiError } from "@/lib/api/api-error";
import { extractProblemTypeSuffix } from "@/lib/api/problem-types";
import { cn } from "@/lib/utils";

const DEFAULT_QUALITY = 80;
const BACK_ICON_SIZE = 14;

export function NewPresetPage(): React.JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { slug } = useParams({ from: "/_protected/namespaces/$slug_/presets/new" });

  const namespaceQuery = useNamespace(slug);
  const namespace = namespaceQuery.data;

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
    control,
    handleSubmit,
    register,
    setError,
    formState: { errors, isSubmitting },
  } = form;

  const watchedName = useWatch({ control, name: "name" });
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

  if (namespaceQuery.isLoading) {
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
          {t("pages.namespaces.presets.new.title")}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("pages.namespaces.presets.new.subtitle", { slug })}
        </p>
      </div>

      {formLevelError ? (
        <div
          id="new-preset-form-error"
          role="alert"
          className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border px-4 py-3 text-sm"
        >
          {formLevelError}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <form
          id="new-preset-form"
          onSubmit={(e) => void handleSubmit(onSubmit)(e)}
          className="space-y-4"
          noValidate
        >
          <PresetNumberedSection
            num={1}
            labelledBy="np-section-identity"
            title={t("pages.namespaces.presets.form.sections.identity")}
            hint={t("pages.namespaces.presets.form.sections.identityHint")}
          >
            <div className="grid gap-2">
              <label htmlFor="np-name" className="text-foreground text-[11.5px] font-medium">
                {t("pages.namespaces.presets.form.name")}
              </label>
              <div
                className={cn(
                  "border-input bg-background flex h-9 items-center overflow-hidden rounded-md border transition-colors",
                  errors.name ? "border-destructive" : "focus-within:ring-ring focus-within:ring-2",
                )}
              >
                <span className="border-border bg-secondary/60 text-muted-foreground border-r px-3 py-1 font-mono text-[12px] select-none">
                  {slug}/&lt;id&gt;@
                </span>
                <input
                  id="np-name"
                  placeholder="thumbnail-sm"
                  spellCheck={false}
                  className="placeholder:text-muted-foreground/60 flex-1 bg-transparent px-3 font-mono text-[12.5px] outline-none"
                  aria-invalid={errors.name ? true : undefined}
                  aria-describedby={errors.name ? "np-name-error" : "np-name-help"}
                  {...register("name")}
                />
              </div>
              <p id="np-name-help" className="text-muted-foreground mt-1 text-[11px]">
                {t("pages.namespaces.presets.form.nameHelp")}
              </p>
              {errors.name?.message ? (
                <p id="np-name-error" className="text-destructive mt-1 text-[11px]">
                  {errors.name.message}
                </p>
              ) : null}
            </div>
          </PresetNumberedSection>

          <PresetParamsFields<ICreatePresetValues>
            register={register}
            errors={errors}
            idPrefix="np"
          />

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

        <PresetPreviewRail<ICreatePresetValues>
          control={control}
          slug={slug}
          presetName={watchedName}
        />
      </div>
    </div>
  );
}
