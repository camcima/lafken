import { ValidationError } from "@/shared/kernel/domain/errors/validation-error.interface";

export type PresetFit = "cover" | "contain" | "fill" | "inside" | "outside";
export type PresetFormat = "webp" | "avif" | "jpeg" | "png" | "auto";

export interface IPresetParamsProps {
  width: number | null;
  height: number | null;
  fit: PresetFit;
  format: PresetFormat;
  quality: number;
  dpr: number | null;
}

const FITS: readonly PresetFit[] = ["cover", "contain", "fill", "inside", "outside"];
const FORMATS: readonly PresetFormat[] = ["webp", "avif", "jpeg", "png", "auto"];

export class InvalidPresetParamsError extends ValidationError {
  constructor(props: { violations: Array<{ field: string; message: string }> }) {
    super({
      message: `Invalid preset params: ${props.violations.map((v) => `${v.field}: ${v.message}`).join("; ")}`,
      params: props,
    });
  }
}

export class PresetParams {
  private constructor(public readonly props: IPresetParamsProps) {}

  static fromUnknown(value: unknown): PresetParams {
    if (!value || typeof value !== "object") {
      throw new InvalidPresetParamsError({
        violations: [{ field: "params", message: "must be an object" }],
      });
    }
    const v = value as Record<string, unknown>;
    const violations: Array<{ field: string; message: string }> = [];

    const width = PresetParams.parseOptionalInt(v["width"], "width", 1, 10000, violations);
    const height = PresetParams.parseOptionalInt(v["height"], "height", 1, 10000, violations);
    const fit =
      typeof v["fit"] === "string" && (FITS as readonly string[]).includes(v["fit"] as string)
        ? (v["fit"] as PresetFit)
        : (violations.push({ field: "fit", message: `must be one of ${FITS.join(", ")}` }),
          "cover" as PresetFit);
    const format =
      typeof v["format"] === "string" &&
      (FORMATS as readonly string[]).includes(v["format"] as string)
        ? (v["format"] as PresetFormat)
        : (violations.push({
            field: "format",
            message: `must be one of ${FORMATS.join(", ")}`,
          }),
          "auto" as PresetFormat);
    const quality = PresetParams.parseRequiredInt(v["quality"], "quality", 1, 100, violations);
    const dpr = PresetParams.parseOptionalNumber(v["dpr"], "dpr", 0.5, 4, violations);

    if (violations.length > 0) {
      throw new InvalidPresetParamsError({ violations });
    }
    return new PresetParams({ width, height, fit, format, quality, dpr });
  }

  toJSON(): IPresetParamsProps {
    return { ...this.props };
  }

  private static parseOptionalInt(
    raw: unknown,
    field: string,
    min: number,
    max: number,
    violations: Array<{ field: string; message: string }>,
  ): number | null {
    if (raw === null || raw === undefined) return null;
    if (typeof raw !== "number" || !Number.isInteger(raw) || raw < min || raw > max) {
      violations.push({ field, message: `must be an integer between ${min} and ${max}` });
      return null;
    }
    return raw;
  }

  private static parseRequiredInt(
    raw: unknown,
    field: string,
    min: number,
    max: number,
    violations: Array<{ field: string; message: string }>,
  ): number {
    if (typeof raw !== "number" || !Number.isInteger(raw) || raw < min || raw > max) {
      violations.push({ field, message: `must be an integer between ${min} and ${max}` });
      return min;
    }
    return raw;
  }

  private static parseOptionalNumber(
    raw: unknown,
    field: string,
    min: number,
    max: number,
    violations: Array<{ field: string; message: string }>,
  ): number | null {
    if (raw === null || raw === undefined) return null;
    if (typeof raw !== "number" || raw < min || raw > max) {
      violations.push({ field, message: `must be a number between ${min} and ${max}` });
      return null;
    }
    return raw;
  }
}
