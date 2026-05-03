import { describe, expect, it } from "vitest";

import { LegalHold } from "@/legal-holds/domain/entities/legal-hold.entity";

import { LegalHoldResponseMapper } from "./legal-hold.response-mapper";

describe("LegalHoldResponseMapper", () => {
  it("maps an active legal hold to the response DTO shape", () => {
    const result = LegalHoldResponseMapper.fromDomain(
      LegalHold.fromProps({
        id: 1n,
        caseReference: "CASE-2026-001",
        description: "Hold for litigation purposes",
        scopeSummary: "All aircraft inspection photos from 2024",
        placedBy: "legal-team@example.com",
        placedAt: new Date("2026-01-01T00:00:00Z"),
        liftedBy: null,
        liftedAt: null,
        liftReason: null,
        active: true,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-02T00:00:00Z"),
      }),
      5,
    );

    expect(result).toEqual({
      id: "1",
      caseReference: "CASE-2026-001",
      description: "Hold for litigation purposes",
      scopeSummary: "All aircraft inspection photos from 2024",
      placedBy: "legal-team@example.com",
      placedAt: "2026-01-01T00:00:00.000Z",
      liftedBy: undefined,
      liftedAt: undefined,
      liftReason: undefined,
      active: true,
      affectedAssetCount: 5,
    });
  });

  it("maps a lifted legal hold with optional fields populated", () => {
    const result = LegalHoldResponseMapper.fromDomain(
      LegalHold.fromProps({
        id: 2n,
        caseReference: "CASE-2025-042",
        description: "Resolved litigation hold",
        scopeSummary: "Documents related to Q3 audit",
        placedBy: "compliance@example.com",
        placedAt: new Date("2025-06-01T00:00:00Z"),
        liftedBy: "counsel@example.com",
        liftedAt: new Date("2025-12-31T23:59:59Z"),
        liftReason: "Case settled",
        active: false,
        createdAt: new Date("2025-06-01T00:00:00Z"),
        updatedAt: new Date("2025-12-31T23:59:59Z"),
      }),
      0,
    );

    expect(result).toMatchObject({
      id: "2",
      active: false,
      liftedBy: "counsel@example.com",
      liftedAt: "2025-12-31T23:59:59.000Z",
      liftReason: "Case settled",
      affectedAssetCount: 0,
    });
  });
});
