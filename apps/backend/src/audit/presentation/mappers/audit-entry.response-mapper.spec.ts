import { describe, expect, it } from "vitest";

import { AuditEntry } from "@/audit/domain/entities/audit-entry.entity";

import { AuditEntryResponseMapper } from "./audit-entry.response-mapper";

describe("AuditEntryResponseMapper", () => {
  it("maps an audit entry with all fields populated to the response DTO shape", () => {
    const occurredAt = new Date("2026-03-01T10:00:00Z");
    const createdAt = new Date("2026-03-01T10:00:00Z");
    const updatedAt = new Date("2026-03-01T10:00:00Z");

    const result = AuditEntryResponseMapper.fromDomain(
      AuditEntry.fromProps({
        id: "01900000-0000-7000-8000-000000000061",
        entityType: "namespace",
        entityId: "ns-abc-123",
        action: "create",
        occurredBy: "admin@example.com",
        beforeState: null,
        afterState: { slug: "my-namespace", displayName: "My Namespace" },
        reason: "Initial setup",
        occurredAt,
        createdAt,
        updatedAt,
      }),
    );

    expect(result).toEqual({
      id: "01900000-0000-7000-8000-000000000061",
      entityType: "namespace",
      entityId: "ns-abc-123",
      action: "create",
      occurredBy: "admin@example.com",
      beforeState: undefined,
      afterState: { slug: "my-namespace", displayName: "My Namespace" },
      reason: "Initial setup",
      occurredAt: occurredAt.toISOString(),
    });
  });

  it("maps optional fields to undefined when null", () => {
    const occurredAt = new Date("2026-04-10T12:00:00Z");

    const result = AuditEntryResponseMapper.fromDomain(
      AuditEntry.fromProps({
        id: "01900000-0000-7000-8000-000000000062",
        entityType: "asset",
        entityId: "asset-xyz",
        action: "delete",
        occurredBy: "user@example.com",
        beforeState: { state: "active" },
        afterState: null,
        reason: null,
        occurredAt,
        createdAt: occurredAt,
        updatedAt: occurredAt,
      }),
    );

    expect(result.id).toBe("01900000-0000-7000-8000-000000000062");
    expect(result.beforeState).toEqual({ state: "active" });
    expect(result.afterState).toBeUndefined();
    expect(result.reason).toBeUndefined();
    expect(result.occurredAt).toBe(occurredAt.toISOString());
  });
});
