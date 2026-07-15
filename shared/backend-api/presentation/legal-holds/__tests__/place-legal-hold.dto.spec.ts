import { randomUUID } from "node:crypto";

import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { describe, expect, it } from "vitest";

import {
  LEGAL_HOLD_ASSET_IDS_MAX,
  LEGAL_HOLD_ASSET_IDS_MIN,
  LEGAL_HOLD_CASE_REFERENCE_MAX_LENGTH,
  LEGAL_HOLD_CASE_REFERENCE_MIN_LENGTH,
  LEGAL_HOLD_DESCRIPTION_MAX_LENGTH,
  LEGAL_HOLD_DESCRIPTION_MIN_LENGTH,
} from "../../../shared/validation-constants";
import { PlaceLegalHoldRequestDTO } from "../place-legal-hold.dto";

// Proves PlaceLegalHoldRequestDTO's bounds are wired to the shared
// LEGAL_HOLD_* constants — Task 13 wires the same constants into the web
// legal-hold form, so this suite is what keeps the two sides from drifting.

function uuids(count: number): string[] {
  return Array.from({ length: count }, () => randomUUID());
}

function basePayload(
  overrides: Partial<{ caseReference: string; description: string; assetIds: string[] }> = {},
): Record<string, unknown> {
  return {
    caseReference: overrides.caseReference ?? "x".repeat(LEGAL_HOLD_CASE_REFERENCE_MIN_LENGTH),
    description: overrides.description ?? "y".repeat(LEGAL_HOLD_DESCRIPTION_MIN_LENGTH),
    assetIds: overrides.assetIds ?? uuids(1),
  };
}

async function validateDto(payload: Record<string, unknown>) {
  const dto = plainToInstance(PlaceLegalHoldRequestDTO, payload);
  return validate(dto);
}

describe("PlaceLegalHoldRequestDTO — caseReference bound matches LEGAL_HOLD_CASE_REFERENCE_MIN/MAX_LENGTH", () => {
  it(`accepts caseReference at the ${String(LEGAL_HOLD_CASE_REFERENCE_MIN_LENGTH)}/${String(LEGAL_HOLD_CASE_REFERENCE_MAX_LENGTH)} bounds`, async () => {
    const shortErrors = await validateDto(
      basePayload({ caseReference: "x".repeat(LEGAL_HOLD_CASE_REFERENCE_MIN_LENGTH) }),
    );
    const longErrors = await validateDto(
      basePayload({ caseReference: "x".repeat(LEGAL_HOLD_CASE_REFERENCE_MAX_LENGTH) }),
    );
    expect(shortErrors.some((e) => e.property === "caseReference")).toBe(false);
    expect(longErrors.some((e) => e.property === "caseReference")).toBe(false);
  });

  it(`rejects caseReference outside the ${String(LEGAL_HOLD_CASE_REFERENCE_MIN_LENGTH)}/${String(LEGAL_HOLD_CASE_REFERENCE_MAX_LENGTH)} bounds`, async () => {
    const tooShort = await validateDto(
      basePayload({ caseReference: "x".repeat(LEGAL_HOLD_CASE_REFERENCE_MIN_LENGTH - 1) }),
    );
    const tooLong = await validateDto(
      basePayload({ caseReference: "x".repeat(LEGAL_HOLD_CASE_REFERENCE_MAX_LENGTH + 1) }),
    );
    expect(tooShort.some((e) => e.property === "caseReference")).toBe(true);
    expect(tooLong.some((e) => e.property === "caseReference")).toBe(true);
  });
});

describe("PlaceLegalHoldRequestDTO — description bound matches LEGAL_HOLD_DESCRIPTION_MIN/MAX_LENGTH", () => {
  it(`accepts description at the ${String(LEGAL_HOLD_DESCRIPTION_MIN_LENGTH)}/${String(LEGAL_HOLD_DESCRIPTION_MAX_LENGTH)} bounds`, async () => {
    const shortErrors = await validateDto(
      basePayload({ description: "y".repeat(LEGAL_HOLD_DESCRIPTION_MIN_LENGTH) }),
    );
    const longErrors = await validateDto(
      basePayload({ description: "y".repeat(LEGAL_HOLD_DESCRIPTION_MAX_LENGTH) }),
    );
    expect(shortErrors.some((e) => e.property === "description")).toBe(false);
    expect(longErrors.some((e) => e.property === "description")).toBe(false);
  });

  it(`rejects description outside the ${String(LEGAL_HOLD_DESCRIPTION_MIN_LENGTH)}/${String(LEGAL_HOLD_DESCRIPTION_MAX_LENGTH)} bounds`, async () => {
    const tooShort = await validateDto(
      basePayload({ description: "y".repeat(LEGAL_HOLD_DESCRIPTION_MIN_LENGTH - 1) }),
    );
    const tooLong = await validateDto(
      basePayload({ description: "y".repeat(LEGAL_HOLD_DESCRIPTION_MAX_LENGTH + 1) }),
    );
    expect(tooShort.some((e) => e.property === "description")).toBe(true);
    expect(tooLong.some((e) => e.property === "description")).toBe(true);
  });
});

describe("PlaceLegalHoldRequestDTO — assetIds size bound matches LEGAL_HOLD_ASSET_IDS_MIN/MAX", () => {
  it(`accepts assetIds at the ${String(LEGAL_HOLD_ASSET_IDS_MIN)}/${String(LEGAL_HOLD_ASSET_IDS_MAX)} bounds`, async () => {
    const minErrors = await validateDto(basePayload({ assetIds: uuids(LEGAL_HOLD_ASSET_IDS_MIN) }));
    const maxErrors = await validateDto(basePayload({ assetIds: uuids(LEGAL_HOLD_ASSET_IDS_MAX) }));
    expect(minErrors.some((e) => e.property === "assetIds")).toBe(false);
    expect(maxErrors.some((e) => e.property === "assetIds")).toBe(false);
  });

  it(`rejects assetIds outside the ${String(LEGAL_HOLD_ASSET_IDS_MIN)}/${String(LEGAL_HOLD_ASSET_IDS_MAX)} bounds`, async () => {
    const tooFew = await validateDto(basePayload({ assetIds: [] }));
    const tooMany = await validateDto(
      basePayload({ assetIds: uuids(LEGAL_HOLD_ASSET_IDS_MAX + 1) }),
    );
    expect(tooFew.some((e) => e.property === "assetIds")).toBe(true);
    expect(tooMany.some((e) => e.property === "assetIds")).toBe(true);
  });
});
