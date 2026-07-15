import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { describe, expect, it } from "vitest";

import { PRESET_NAME_MAX_LENGTH } from "../../../shared/validation-constants";
import { CreatePresetRequestDTO } from "../create-preset-request.dto";

// Proves CreatePresetRequestDTO's `name` bound is wired to the shared
// PRESET_NAME_MAX_LENGTH / PRESET_NAME_PATTERN constants, matching the
// presetNameSchema used by the web preset forms.

function basePayload(name: string): Record<string, unknown> {
  return {
    name,
    params: {
      fit: "cover",
      format: "webp",
      quality: 50,
    },
  };
}

async function validateDto(payload: Record<string, unknown>) {
  const dto = plainToInstance(CreatePresetRequestDTO, payload);
  return validate(dto);
}

describe("CreatePresetRequestDTO — name length bound matches PRESET_NAME_MAX_LENGTH", () => {
  it(`accepts a name of exactly ${String(PRESET_NAME_MAX_LENGTH)} characters`, async () => {
    const name = "a".repeat(PRESET_NAME_MAX_LENGTH);
    const errors = await validateDto(basePayload(name));
    expect(errors.some((e) => e.property === "name")).toBe(false);
  });

  it(`rejects a name of ${String(PRESET_NAME_MAX_LENGTH + 1)} characters`, async () => {
    const name = "a".repeat(PRESET_NAME_MAX_LENGTH + 1);
    const errors = await validateDto(basePayload(name));
    expect(errors.some((e) => e.property === "name")).toBe(true);
  });
});

describe("CreatePresetRequestDTO — name pattern matches PRESET_NAME_PATTERN", () => {
  it("accepts lowercase kebab-case names", async () => {
    const errors = await validateDto(basePayload("thumbnail-large"));
    expect(errors.some((e) => e.property === "name")).toBe(false);
  });

  it("rejects uppercase characters", async () => {
    const errors = await validateDto(basePayload("Thumbnail"));
    expect(errors.some((e) => e.property === "name")).toBe(true);
  });
});
