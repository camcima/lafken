import { plainToInstance } from "class-transformer";
import type { ValidationError } from "class-validator";
import { validate } from "class-validator";
import { describe, expect, it } from "vitest";

import {
  NAMESPACE_DESCRIPTION_MAX_LENGTH,
  NAMESPACE_DISPLAY_NAME_MAX_LENGTH,
} from "../../../shared/validation-constants";
import { UpdateNamespaceMetadataRequestDTO } from "../update-namespace-metadata-request.dto";

// This suite proves the DTO's decorators are wired to the *same* shared
// constants the NamespaceMetadataDrawer form consumes — not to independent
// literals that happen to match today. Each bound is derived from the
// imported constant, so a future edit to `validation-constants.ts` that
// isn't mirrored by the decorator (or vice versa) makes these assertions
// fail.

function validPayload(
  overrides: Partial<{ displayName: string; description: string | null }> = {},
): Record<string, unknown> {
  return {
    displayName: overrides.displayName ?? "Aircraft photos",
    description: overrides.description ?? null,
  };
}

function findError(errors: ValidationError[], property: string): ValidationError | undefined {
  return errors.find((e) => e.property === property);
}

async function validateDto(payload: Record<string, unknown>): Promise<ValidationError[]> {
  const dto = plainToInstance(UpdateNamespaceMetadataRequestDTO, payload);
  return validate(dto);
}

describe("UpdateNamespaceMetadataRequestDTO — displayName bound matches NAMESPACE_DISPLAY_NAME_MAX_LENGTH", () => {
  it(`accepts a displayName of exactly ${String(NAMESPACE_DISPLAY_NAME_MAX_LENGTH)} characters`, async () => {
    const displayName = "d".repeat(NAMESPACE_DISPLAY_NAME_MAX_LENGTH);
    const errors = await validateDto(validPayload({ displayName }));
    expect(findError(errors, "displayName")).toBeUndefined();
  });

  it(`rejects a displayName of ${String(NAMESPACE_DISPLAY_NAME_MAX_LENGTH + 1)} characters`, async () => {
    const displayName = "d".repeat(NAMESPACE_DISPLAY_NAME_MAX_LENGTH + 1);
    const errors = await validateDto(validPayload({ displayName }));
    expect(findError(errors, "displayName")).toBeDefined();
  });
});

describe("UpdateNamespaceMetadataRequestDTO — description bound matches NAMESPACE_DESCRIPTION_MAX_LENGTH", () => {
  it(`accepts a description of exactly ${String(NAMESPACE_DESCRIPTION_MAX_LENGTH)} characters`, async () => {
    const description = "d".repeat(NAMESPACE_DESCRIPTION_MAX_LENGTH);
    const errors = await validateDto(validPayload({ description }));
    expect(findError(errors, "description")).toBeUndefined();
  });

  it(`rejects a description of ${String(NAMESPACE_DESCRIPTION_MAX_LENGTH + 1)} characters`, async () => {
    const description = "d".repeat(NAMESPACE_DESCRIPTION_MAX_LENGTH + 1);
    const errors = await validateDto(validPayload({ description }));
    expect(findError(errors, "description")).toBeDefined();
  });
});
