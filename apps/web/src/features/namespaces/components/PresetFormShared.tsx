import React, { useMemo } from "react";
import type { Control, FieldErrors, FieldValues, Path, UseFormRegister } from "react-hook-form";
import { useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/common/Card";
import {
  type IPresetParamsValues,
  PRESET_FITS,
  PRESET_FORMATS,
} from "@/features/namespaces/schemas/preset-params.schema";
import { cn } from "@/lib/utils";

const MIN_DIMENSION = 1;
const MAX_DIMENSION = 10000;
const MIN_QUALITY = 1;
const MAX_QUALITY = 100;
const MIN_DPR = 0.5;
const MAX_DPR = 4;
const DPR_STEP = 0.5;
const RADIO_CARD_COLUMNS_2 = 2;
const RADIO_CARD_COLUMNS_3 = 3;
const RADIO_CARD_COLUMNS_4 = 4;

interface INumberedSectionProps {
  num: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
  labelledBy: string;
}

export function PresetNumberedSection(props: Readonly<INumberedSectionProps>): React.JSX.Element {
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
      <div className="space-y-5 px-6 py-5">{children}</div>
    </Card>
  );
}

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

const inputClasses = cn(
  "border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm",
  "ring-offset-background placeholder:text-muted-foreground",
  "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

const selectClasses = inputClasses;

function FieldHint({
  children,
}: Readonly<{ children?: React.ReactNode }>): React.JSX.Element | null {
  if (!children) return null;
  return <p className="text-muted-foreground mt-1 text-[11px]">{children}</p>;
}

interface IRadioCardOption<V extends string> {
  value: V;
  label: string;
  description?: string;
}

interface IRadioCardGroupProps<T extends FieldValues, V extends string> {
  control: Control<T>;
  register: UseFormRegister<T>;
  name: Path<T>;
  options: ReadonlyArray<IRadioCardOption<V>>;
  ariaLabelledBy?: string;
  columns?: typeof RADIO_CARD_COLUMNS_2 | typeof RADIO_CARD_COLUMNS_3 | typeof RADIO_CARD_COLUMNS_4;
}

/**
 * Radio-card group: each option renders as a clickable card with title and
 * description, replacing a native <select> for enums where per-option meaning
 * is non-obvious. The hidden radio inputs share `name` and integrate with
 * react-hook-form via `register`; the selected card is highlighted by
 * subscribing to the field value through useWatch.
 */
export function RadioCardGroup<T extends FieldValues, V extends string>(
  props: Readonly<IRadioCardGroupProps<T, V>>,
): React.JSX.Element {
  const {
    control,
    register,
    name,
    options,
    ariaLabelledBy,
    columns = RADIO_CARD_COLUMNS_2,
  } = props;
  const current = useWatch({ control, name }) as V | undefined;

  const colClass =
    columns === RADIO_CARD_COLUMNS_4
      ? "sm:grid-cols-2 lg:grid-cols-4"
      : columns === RADIO_CARD_COLUMNS_3
        ? "sm:grid-cols-3"
        : "sm:grid-cols-2";

  return (
    <div role="radiogroup" aria-labelledby={ariaLabelledBy} className={cn("grid gap-2", colClass)}>
      {options.map((opt) => {
        const active = current === opt.value;
        return (
          <label
            key={opt.value}
            className={cn(
              "relative flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 transition-colors",
              active
                ? "border-latam-indigo bg-latam-indigo/[0.04] ring-latam-indigo/30 ring-1"
                : "border-border bg-card hover:border-latam-indigo/30 hover:bg-secondary/40",
            )}
          >
            <input type="radio" value={opt.value} className="sr-only" {...register(name)} />
            <span
              aria-hidden="true"
              className={cn(
                "mt-0.5 grid size-3.5 flex-none place-items-center rounded-full border-2",
                active ? "border-latam-indigo" : "border-border",
              )}
            >
              {active ? <span className="bg-latam-indigo size-1.5 rounded-full" /> : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-foreground block text-[12.5px] leading-tight font-medium">
                {opt.label}
              </span>
              {opt.description ? (
                <span className="text-muted-foreground mt-0.5 block text-[11px] leading-snug">
                  {opt.description}
                </span>
              ) : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}

interface IQualitySliderProps<T extends FieldValues> {
  control: Control<T>;
  register: UseFormRegister<T>;
  name: Path<T>;
  inputId: string;
  min: number;
  max: number;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  ariaLabelledBy?: string;
}

/**
 * Quality slider — pairs a controlled range input (driven by useWatch so the
 * thumb tracks edits to the number input) with an uncontrolled number input
 * that registers directly with react-hook-form. Sharing the same field name
 * keeps both inputs in sync without registering the field twice.
 */
function QualitySlider<T extends FieldValues>(
  props: Readonly<IQualitySliderProps<T>>,
): React.JSX.Element {
  const {
    control,
    register,
    name,
    inputId,
    min,
    max,
    ariaInvalid,
    ariaDescribedBy,
    ariaLabelledBy,
  } = props;

  const watched = useWatch({ control, name }) as number | undefined;
  const rangeValue = typeof watched === "number" && Number.isFinite(watched) ? watched : min;
  const registered = register(name, { valueAsNumber: true });

  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        value={rangeValue}
        onChange={(event) => {
          void registered.onChange(event);
        }}
        onBlur={(event) => {
          void registered.onBlur(event);
        }}
        aria-labelledby={ariaLabelledBy}
        className="accent-latam-indigo flex-1"
      />
      <input
        id={inputId}
        type="number"
        min={min}
        max={max}
        className={cn(inputClasses, "w-20 font-mono")}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        aria-labelledby={ariaLabelledBy}
        {...registered}
      />
    </div>
  );
}

interface IPresetParamsFieldsProps<T extends FieldValues> {
  control: Control<T>;
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
  idPrefix: string;
}

/**
 * Renders sections 02 (Output dimensions) and 03 (Encoding) for any preset
 * form whose values include a `params` field of shape IPresetParamsValues.
 */
export function PresetParamsFields<T extends FieldValues>(
  props: Readonly<IPresetParamsFieldsProps<T>>,
): React.JSX.Element {
  const { control, register, errors, idPrefix } = props;
  const { t } = useTranslation();

  const paramsErrors = (errors as FieldErrors<{ params: IPresetParamsValues }>).params;

  const widthPath = "params.width" as Path<T>;
  const heightPath = "params.height" as Path<T>;
  const fitPath = "params.fit" as Path<T>;
  const formatPath = "params.format" as Path<T>;
  const qualityPath = "params.quality" as Path<T>;
  const dprPath = "params.dpr" as Path<T>;

  const fitOptions = PRESET_FITS.map((fit) => ({
    value: fit,
    label: fit,
    description: t(`pages.namespaces.presets.form.fitOptions.${fit}`),
  }));

  return (
    <>
      <PresetNumberedSection
        num={2}
        labelledBy={`${idPrefix}-section-dimensions`}
        title={t("pages.namespaces.presets.form.sections.dimensions")}
        hint={t("pages.namespaces.presets.form.sections.dimensionsHint")}
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="grid gap-1">
            <FieldLabel htmlFor={`${idPrefix}-width`}>
              {t("pages.namespaces.presets.form.width")}
            </FieldLabel>
            <input
              id={`${idPrefix}-width`}
              type="number"
              min={MIN_DIMENSION}
              max={MAX_DIMENSION}
              placeholder="—"
              className={cn(inputClasses, "font-mono")}
              aria-invalid={paramsErrors?.width ? true : undefined}
              aria-describedby={
                paramsErrors?.width ? `${idPrefix}-width-error` : `${idPrefix}-width-hint`
              }
              {...register(widthPath, {
                setValueAs: (rawValue: string) => (rawValue === "" ? undefined : Number(rawValue)),
              })}
            />
            {paramsErrors?.width?.message ? (
              <FieldMessage id={`${idPrefix}-width-error`}>
                {paramsErrors.width.message}
              </FieldMessage>
            ) : (
              <FieldHint>{t("pages.namespaces.presets.form.widthHint")}</FieldHint>
            )}
          </div>

          <div className="grid gap-1">
            <FieldLabel htmlFor={`${idPrefix}-height`}>
              {t("pages.namespaces.presets.form.height")}
            </FieldLabel>
            <input
              id={`${idPrefix}-height`}
              type="number"
              min={MIN_DIMENSION}
              max={MAX_DIMENSION}
              placeholder="—"
              className={cn(inputClasses, "font-mono")}
              aria-invalid={paramsErrors?.height ? true : undefined}
              aria-describedby={
                paramsErrors?.height ? `${idPrefix}-height-error` : `${idPrefix}-height-hint`
              }
              {...register(heightPath, {
                setValueAs: (rawValue: string) => (rawValue === "" ? undefined : Number(rawValue)),
              })}
            />
            {paramsErrors?.height?.message ? (
              <FieldMessage id={`${idPrefix}-height-error`}>
                {paramsErrors.height.message}
              </FieldMessage>
            ) : (
              <FieldHint>{t("pages.namespaces.presets.form.heightHint")}</FieldHint>
            )}
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <span
              id={`${idPrefix}-fit-label`}
              className="text-foreground text-[11.5px] font-medium"
            >
              {t("pages.namespaces.presets.form.fit")}
            </span>
            <RadioCardGroup<T, (typeof PRESET_FITS)[number]>
              control={control}
              register={register}
              name={fitPath}
              options={fitOptions}
              ariaLabelledBy={`${idPrefix}-fit-label`}
              columns={3}
            />
            {paramsErrors?.fit?.message ? (
              <FieldMessage id={`${idPrefix}-fit-error`}>{paramsErrors.fit.message}</FieldMessage>
            ) : (
              <FieldHint>{t("pages.namespaces.presets.form.fitHint")}</FieldHint>
            )}
          </div>

          <div className="grid gap-1">
            <FieldLabel htmlFor={`${idPrefix}-dpr`}>
              {t("pages.namespaces.presets.form.dpr")}
            </FieldLabel>
            <input
              id={`${idPrefix}-dpr`}
              type="number"
              min={MIN_DPR}
              max={MAX_DPR}
              step={DPR_STEP}
              placeholder="—"
              className={cn(inputClasses, "font-mono")}
              aria-invalid={paramsErrors?.dpr ? true : undefined}
              aria-describedby={
                paramsErrors?.dpr ? `${idPrefix}-dpr-error` : `${idPrefix}-dpr-hint`
              }
              {...register(dprPath, {
                setValueAs: (rawValue: string) => (rawValue === "" ? undefined : Number(rawValue)),
              })}
            />
            {paramsErrors?.dpr?.message ? (
              <FieldMessage id={`${idPrefix}-dpr-error`}>{paramsErrors.dpr.message}</FieldMessage>
            ) : (
              <FieldHint>{t("pages.namespaces.presets.form.dprHint")}</FieldHint>
            )}
          </div>
        </div>
      </PresetNumberedSection>

      <PresetNumberedSection
        num={3}
        labelledBy={`${idPrefix}-section-encoding`}
        title={t("pages.namespaces.presets.form.sections.encoding")}
        hint={t("pages.namespaces.presets.form.sections.encodingHint")}
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="grid gap-1">
            <FieldLabel htmlFor={`${idPrefix}-format`}>
              {t("pages.namespaces.presets.form.format")}
            </FieldLabel>
            <select
              id={`${idPrefix}-format`}
              className={selectClasses}
              aria-invalid={paramsErrors?.format ? true : undefined}
              aria-describedby={
                paramsErrors?.format ? `${idPrefix}-format-error` : `${idPrefix}-format-hint`
              }
              {...register(formatPath)}
            >
              {PRESET_FORMATS.map((format) => (
                <option key={format} value={format}>
                  {format}
                </option>
              ))}
            </select>
            {paramsErrors?.format?.message ? (
              <FieldMessage id={`${idPrefix}-format-error`}>
                {paramsErrors.format.message}
              </FieldMessage>
            ) : (
              <FieldHint>{t("pages.namespaces.presets.form.formatHint")}</FieldHint>
            )}
          </div>

          <div className="grid gap-1">
            <span
              id={`${idPrefix}-quality-label`}
              className="text-foreground text-[11.5px] font-medium"
            >
              {t("pages.namespaces.presets.form.quality")}
            </span>
            <QualitySlider<T>
              control={control}
              register={register}
              name={qualityPath}
              inputId={`${idPrefix}-quality`}
              min={MIN_QUALITY}
              max={MAX_QUALITY}
              ariaInvalid={paramsErrors?.quality ? true : undefined}
              ariaLabelledBy={`${idPrefix}-quality-label`}
              ariaDescribedBy={
                paramsErrors?.quality ? `${idPrefix}-quality-error` : `${idPrefix}-quality-hint`
              }
            />
            {paramsErrors?.quality?.message ? (
              <FieldMessage id={`${idPrefix}-quality-error`}>
                {paramsErrors.quality.message}
              </FieldMessage>
            ) : (
              <FieldHint>{t("pages.namespaces.presets.form.qualityHint")}</FieldHint>
            )}
          </div>
        </div>
      </PresetNumberedSection>
    </>
  );
}

interface IPresetPreviewRailProps<T extends FieldValues> {
  control: Control<T>;
  slug: string;
  presetName: string;
}

/**
 * Right-rail preview shown on lg+ screens. Subscribes to params via useWatch so
 * field-level re-renders stay isolated to this component. Renders the live
 * sample serving URL for the preset in its current configuration.
 */
export function PresetPreviewRail<T extends FieldValues>(
  props: Readonly<IPresetPreviewRailProps<T>>,
): React.JSX.Element {
  const { control, slug, presetName } = props;
  const { t } = useTranslation();

  const params = useWatch({ control, name: "params" as Path<T> }) as
    | Partial<IPresetParamsValues>
    | undefined;

  const sampleUrl = useMemo(() => {
    const segments: string[] = [];
    if (params?.width) segments.push(`w_${params.width}`);
    if (params?.height) segments.push(`h_${params.height}`);
    if (params?.fit) segments.push(`fit_${params.fit}`);
    if (params?.format) segments.push(`fmt_${params.format}`);
    if (params?.quality) segments.push(`q_${params.quality}`);
    if (params?.dpr) segments.push(`dpr_${params.dpr}`);
    const name = presetName || "<preset>";
    const query = segments.length > 0 ? `?${segments.join("&")}` : "";
    return `/v1/i/${slug}/<id>@${name}${query}`;
  }, [params, slug, presetName]);

  return (
    <aside
      aria-label={t("pages.namespaces.presets.form.previewLabel")}
      className="hidden lg:sticky lg:top-6 lg:block lg:self-start"
    >
      <div className="border-border/60 mb-2 flex items-center justify-between border-b pb-2">
        <span className="text-muted-foreground text-[10.5px] font-medium tracking-wider uppercase">
          {t("pages.namespaces.presets.form.sampleUrlTitle")}
        </span>
        <span className="text-muted-foreground font-mono text-[10.5px]">URL</span>
      </div>
      <pre className="m-0 max-h-[640px] overflow-auto rounded-md bg-[#0F0A2E] px-4 py-3 font-mono text-[11px] leading-[1.6] break-all whitespace-pre-wrap text-[#C2D0E0]">
        {sampleUrl}
      </pre>
    </aside>
  );
}
