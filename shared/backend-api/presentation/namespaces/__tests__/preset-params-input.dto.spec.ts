import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { describe, expect, it } from "vitest";

import {
  PRESET_DIMENSION_MAX,
  PRESET_DIMENSION_MIN,
  PRESET_DPR_MAX,
  PRESET_DPR_MIN,
  PRESET_QUALITY_MAX,
  PRESET_QUALITY_MIN,
} from "../../../shared/validation-constants";
import { PresetParamsInputDTO } from "../preset-params-input.dto";

// Proves PresetParamsInputDTO enforces exactly the shared PRESET_* bounds
// consumed by the web preset-params Zod schema — not independent literals.

function basePayload(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
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

async function validateDto(payload: Record<string, unknown>) {
  const dto = plainToInstance(PresetParamsInputDTO, payload);
  return validate(dto);
}

describe("PresetParamsInputDTO — width/height bounds match PRESET_DIMENSION_MIN/MAX", () => {
  it(`accepts width/height at the ${String(PRESET_DIMENSION_MIN)}..${String(PRESET_DIMENSION_MAX)} bounds`, async () => {
    const errors = await validateDto(
      basePayload({ width: PRESET_DIMENSION_MIN, height: PRESET_DIMENSION_MAX }),
    );
    expect(errors).toHaveLength(0);
  });

  it(`rejects width below ${String(PRESET_DIMENSION_MIN)}`, async () => {
    const errors = await validateDto(basePayload({ width: PRESET_DIMENSION_MIN - 1 }));
    expect(errors.some((e) => e.property === "width")).toBe(true);
  });

  it(`rejects height above ${String(PRESET_DIMENSION_MAX)}`, async () => {
    const errors = await validateDto(basePayload({ height: PRESET_DIMENSION_MAX + 1 }));
    expect(errors.some((e) => e.property === "height")).toBe(true);
  });
});

describe("PresetParamsInputDTO — quality bound matches PRESET_QUALITY_MIN/MAX", () => {
  it(`accepts quality at the ${String(PRESET_QUALITY_MIN)}/${String(PRESET_QUALITY_MAX)} bounds`, async () => {
    const lowErrors = await validateDto(basePayload({ quality: PRESET_QUALITY_MIN }));
    const highErrors = await validateDto(basePayload({ quality: PRESET_QUALITY_MAX }));
    expect(lowErrors).toHaveLength(0);
    expect(highErrors).toHaveLength(0);
  });

  it(`rejects quality outside the ${String(PRESET_QUALITY_MIN)}/${String(PRESET_QUALITY_MAX)} bounds`, async () => {
    const belowErrors = await validateDto(basePayload({ quality: PRESET_QUALITY_MIN - 1 }));
    const aboveErrors = await validateDto(basePayload({ quality: PRESET_QUALITY_MAX + 1 }));
    expect(belowErrors.some((e) => e.property === "quality")).toBe(true);
    expect(aboveErrors.some((e) => e.property === "quality")).toBe(true);
  });
});

describe("PresetParamsInputDTO — dpr bound matches PRESET_DPR_MIN/MAX", () => {
  it(`accepts dpr at the ${String(PRESET_DPR_MIN)}/${String(PRESET_DPR_MAX)} bounds`, async () => {
    const lowErrors = await validateDto(basePayload({ dpr: PRESET_DPR_MIN }));
    const highErrors = await validateDto(basePayload({ dpr: PRESET_DPR_MAX }));
    expect(lowErrors).toHaveLength(0);
    expect(highErrors).toHaveLength(0);
  });

  it(`rejects dpr outside the ${String(PRESET_DPR_MIN)}/${String(PRESET_DPR_MAX)} bounds`, async () => {
    const belowErrors = await validateDto(basePayload({ dpr: PRESET_DPR_MIN - 0.1 }));
    const aboveErrors = await validateDto(basePayload({ dpr: PRESET_DPR_MAX + 0.1 }));
    expect(belowErrors.some((e) => e.property === "dpr")).toBe(true);
    expect(aboveErrors.some((e) => e.property === "dpr")).toBe(true);
  });
});
