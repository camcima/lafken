import { AsyncLocalStorage } from "node:async_hooks";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { AuditWriteRepository } from "@/audit/infrastructure/persistence/repositories/audit-write.repository";
import { ConnectionResolver } from "@/shared/infrastructure/persistence/connection-resolver";
import { DatabaseAsyncLocalStorage } from "@/shared/infrastructure/persistence/database-async-local-storage";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";
import { DatabaseUnitOfWork } from "@/shared/infrastructure/persistence/database-unit-of-work";

import { cleanDatabase } from "../../helpers/clean-database";
import { createTestDatabaseClient } from "../../helpers/create-test-database-client";

describe("AuditWriteRepository", () => {
  let db: DatabaseClient;
  let unitOfWork: DatabaseUnitOfWork;
  let repository: AuditWriteRepository;

  beforeAll(async () => {
    db = await createTestDatabaseClient();
    // The resolver and the UoW must share the same AsyncLocalStorage so
    // record() joins the ambient transaction.
    const als = new DatabaseAsyncLocalStorage(new AsyncLocalStorage());
    const resolver = new ConnectionResolver(db, als);
    unitOfWork = new DatabaseUnitOfWork(als, db);
    repository = new AuditWriteRepository(resolver);
  });

  beforeEach(async () => {
    await cleanDatabase(db);
  });

  afterAll(async () => {
    await db.closeConnection();
  });

  it("record inserts a complete audit row", async () => {
    await repository.record({
      entityType: "namespace",
      entityId: "aircraft-photos",
      action: "update",
      occurredBy: "ops@latam.com",
      beforeState: { displayName: "Old" },
      afterState: { displayName: "New" },
      reason: "rename requested by ops",
      requestIp: "203.0.113.7",
    });

    const rows = await db.connection.selectFrom("configuration_audit_log").selectAll().execute();
    expect(rows).toHaveLength(1);
    const row = rows[0] as Record<string, unknown>;
    expect(row.entity_type).toBe("namespace");
    expect(row.entity_id).toBe("aircraft-photos");
    expect(row.action).toBe("update");
    expect(row.occurred_by).toBe("ops@latam.com");
    expect(row.before_state).toEqual({ displayName: "Old" });
    expect(row.after_state).toEqual({ displayName: "New" });
    expect(row.reason).toBe("rename requested by ops");
    expect(String(row.request_ip)).toContain("203.0.113.7");
    expect(row.occurred_at).toBeInstanceOf(Date);
  });

  it("record stores null before/after state and request ip when omitted", async () => {
    await repository.record({
      entityType: "legal_hold",
      entityId: "some-hold-id",
      action: "lift",
      occurredBy: "legal@latam.com",
    });

    const rows = await db.connection.selectFrom("configuration_audit_log").selectAll().execute();
    expect(rows).toHaveLength(1);
    const row = rows[0] as Record<string, unknown>;
    expect(row.before_state).toBeNull();
    expect(row.after_state).toBeNull();
    expect(row.reason).toBeNull();
    expect(row.request_ip).toBeNull();
  });

  it("record joins an ambient UnitOfWork transaction and rolls back with it", async () => {
    await expect(
      unitOfWork.execute(async () => {
        await repository.record({
          entityType: "namespace",
          entityId: "rolled-back",
          action: "update",
          occurredBy: "ops@latam.com",
        });
        throw new Error("boom — roll it all back");
      }),
    ).rejects.toThrow("boom — roll it all back");

    const rows = await db.connection.selectFrom("configuration_audit_log").selectAll().execute();
    expect(rows).toHaveLength(0);
  });

  it("record rejects on an unparseable request ip (inet column) and persists nothing", async () => {
    // This is the real failure mechanism the UoW rollback specs rely on.
    await expect(
      repository.record({
        entityType: "namespace",
        entityId: "bad-ip",
        action: "update",
        occurredBy: "ops@latam.com",
        requestIp: "not-an-ip",
      }),
    ).rejects.toThrow();

    const rows = await db.connection.selectFrom("configuration_audit_log").selectAll().execute();
    expect(rows).toHaveLength(0);
  });
});
