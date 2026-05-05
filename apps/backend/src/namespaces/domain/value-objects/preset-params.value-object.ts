import { InvalidPresetParamsError } from "@/namespaces/domain/errors/invalid-preset-params.error";

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

const DIMENSION_MIN = 1;
const DIMENSION_MAX = 10_000;
const QUALITY_MIN = 1;
const QUALITY_MAX = 100;
const DPR_MIN = 0.5;
const DPR_MAX = 4;

export { InvalidPresetParamsError };

export class PresetParams {
  private constructor(public readonly props: IPresetParamsProps) {}

  static fromUnknown(value: unknown): PresetParams {
    if (!value || typeof value !== "object") {
      throw new InvalidPresetParamsError({
        violations: [{ field: "params", message: "must be an object" }],
      });
    }
    const raw = value as Record<string, unknown>;
    const violations: Array<{ field: string; message: string }> = [];

    const width = PresetParams.parseOptionalInt(
      raw["width"],
      "width",
      DIMENSION_MIN,
      DIMENSION_MAX,
      violations,
    );
    const height = PresetParams.parseOptionalInt(
      raw["height"],
      "height",
      DIMENSION_MIN,
      DIMENSION_MAX,
      violations,
    );
    const fit =
      typeof raw["fit"] === "string" && (FITS as readonly string[]).includes(raw["fit"])
        ? (raw["fit"] as PresetFit)
        : (violations.push({ field: "fit", message: `must be one of ${FITS.join(", ")}` }),
          "cover" as PresetFit);
    const format =
      typeof raw["format"] === "string" && (FORMATS as readonly string[]).includes(raw["format"])
        ? (raw["format"] as PresetFormat)
        : (violations.push({
            field: "format",
            message: `must be one of ${FORMATS.join(", ")}`,
          }),
          "auto" as PresetFormat);
    const quality = PresetParams.parseRequiredInt(
      raw["quality"],
      "quality",
      QUALITY_MIN,
      QUALITY_MAX,
      violations,
    );
    const dpr = PresetParams.parseOptionalNumber(raw["dpr"], "dpr", DPR_MIN, DPR_MAX, violations);

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
