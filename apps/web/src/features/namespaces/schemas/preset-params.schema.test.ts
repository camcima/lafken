import {
  PRESET_DIMENSION_MAX,
  PRESET_DIMENSION_MIN,
  PRESET_DPR_MAX,
  PRESET_DPR_MIN,
  PRESET_NAME_MAX_LENGTH,
  PRESET_QUALITY_MAX,
  PRESET_QUALITY_MIN,
  PRESET_FITS as SHARED_PRESET_FITS,
  PRESET_FORMATS as SHARED_PRESET_FORMATS,
} from "@shared/backend-api/validation";
import { describe, expect, it } from "vitest";

import {
  PRESET_FITS,
  PRESET_FORMATS,
  presetNameSchema,
  presetParamsSchema,
} from "./preset-params.schema";

// This suite proves presetParamsSchema/presetNameSchema are wired to the
// *same* shared constants the backend PresetParamsInputDTO/CreatePresetRequestDTO
// enforce (see shared/backend-api/presentation/namespaces/__tests__), rather
// than to independent literals that merely happen to match today. Bounds are
// derived from the imported constants, so drift between the shared module and
// this schema — or the shared module and the backend DTOs — fails a test.

function validParams(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    width: 10,
    height: 10,
    fit: "cover",
    format: "webp",
    quality: 50,
    dpr: 1,
    ...overrides,
  };
}

describe("preset-params.schema — re-exports the shared PRESET_FITS/PRESET_FORMATS by reference", () => {
  it("PRESET_FITS is the exact array exported by @shared/backend-api/validation", () => {
    expect(PRESET_FITS).toBe(SHARED_PRESET_FITS);
  });

  it("PRESET_FORMATS is the exact array exported by @shared/backend-api/validation", () => {
    expect(PRESET_FORMATS).toBe(SHARED_PRESET_FORMATS);
  });
});

describe("presetParamsSchema — width/height bound matches PRESET_DIMENSION_MIN/MAX", () => {
  it(`accepts width/height at the ${String(PRESET_DIMENSION_MIN)}..${String(PRESET_DIMENSION_MAX)} bounds`, () => {
    const result = presetParamsSchema.safeParse(
      validParams({ width: PRESET_DIMENSION_MIN, height: PRESET_DIMENSION_MAX }),
    );
    expect(result.success).toBe(true);
  });

  it(`rejects width below ${String(PRESET_DIMENSION_MIN)}`, () => {
    const result = presetParamsSchema.safeParse(validParams({ width: PRESET_DIMENSION_MIN - 1 }));
    expect(result.success).toBe(false);
  });

  it(`rejects height above ${String(PRESET_DIMENSION_MAX)}`, () => {
    const result = presetParamsSchema.safeParse(validParams({ height: PRESET_DIMENSION_MAX + 1 }));
    expect(result.success).toBe(false);
  });
});

describe("presetParamsSchema — quality bound matches PRESET_QUALITY_MIN/MAX", () => {
  it(`accepts quality at the ${String(PRESET_QUALITY_MIN)}/${String(PRESET_QUALITY_MAX)} bounds`, () => {
    expect(presetParamsSchema.safeParse(validParams({ quality: PRESET_QUALITY_MIN })).success).toBe(
      true,
    );
    expect(presetParamsSchema.safeParse(validParams({ quality: PRESET_QUALITY_MAX })).success).toBe(
      true,
    );
  });

  it(`rejects quality outside the ${String(PRESET_QUALITY_MIN)}/${String(PRESET_QUALITY_MAX)} bounds`, () => {
    expect(
      presetParamsSchema.safeParse(validParams({ quality: PRESET_QUALITY_MIN - 1 })).success,
    ).toBe(false);
    expect(
      presetParamsSchema.safeParse(validParams({ quality: PRESET_QUALITY_MAX + 1 })).success,
    ).toBe(false);
  });
});

describe("presetParamsSchema — dpr bound matches PRESET_DPR_MIN/MAX", () => {
  it(`accepts dpr at the ${String(PRESET_DPR_MIN)}/${String(PRESET_DPR_MAX)} bounds`, () => {
    expect(presetParamsSchema.safeParse(validParams({ dpr: PRESET_DPR_MIN })).success).toBe(true);
    expect(presetParamsSchema.safeParse(validParams({ dpr: PRESET_DPR_MAX })).success).toBe(true);
  });

  it(`rejects dpr outside the ${String(PRESET_DPR_MIN)}/${String(PRESET_DPR_MAX)} bounds`, () => {
    expect(presetParamsSchema.safeParse(validParams({ dpr: PRESET_DPR_MIN - 0.1 })).success).toBe(
      false,
    );
    expect(presetParamsSchema.safeParse(validParams({ dpr: PRESET_DPR_MAX + 0.1 })).success).toBe(
      false,
    );
  });
});

describe("presetNameSchema — length bound matches PRESET_NAME_MAX_LENGTH", () => {
  it(`accepts a name of exactly ${String(PRESET_NAME_MAX_LENGTH)} characters`, () => {
    const name = "a".repeat(PRESET_NAME_MAX_LENGTH);
    expect(presetNameSchema.safeParse(name).success).toBe(true);
  });

  it(`rejects a name of ${String(PRESET_NAME_MAX_LENGTH + 1)} characters`, () => {
    const name = "a".repeat(PRESET_NAME_MAX_LENGTH + 1);
    expect(presetNameSchema.safeParse(name).success).toBe(false);
  });
});
