import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { AuditQueryRepository } from "@/audit/infrastructure/persistence/repositories/audit-query.repository";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { createTestDatabaseClient } from "../../helpers/create-test-database-client";

describe("AuditQueryRepository", () => {
  let db: DatabaseClient;
  let repository: AuditQueryRepository;

  beforeAll(async () => {
    db = await createTestDatabaseClient();
    repository = new AuditQueryRepository(db);
  });

  beforeEach(async () => {
    await db.connection.transaction().execute(async (tx) => {
      await tx.deleteFrom("configuration_audit_log").execute();
    });
  });

  afterAll(async () => {
    await db.closeConnection();
  });

  it("returns an empty page when no audit entries exist", async () => {
    const result = await repository.list({ page: 1, limit: 20 });
    expect(result.total).toBe(0);
    expect(result.data).toEqual([]);
    expect(result.lastPage).toBe(1);
  });
});
