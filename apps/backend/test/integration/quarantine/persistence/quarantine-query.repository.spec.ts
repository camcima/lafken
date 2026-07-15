import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { QuarantineQueryRepository } from "@/quarantine/infrastructure/persistence/repositories/quarantine-query.repository";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { cleanDatabase } from "../../helpers/clean-database";
import { createTestDatabaseClient } from "../../helpers/create-test-database-client";

describe("QuarantineQueryRepository", () => {
  let db: DatabaseClient;
  let repository: QuarantineQueryRepository;

  beforeAll(async () => {
    db = await createTestDatabaseClient();
    repository = new QuarantineQueryRepository(db);
  });

  beforeEach(async () => {
    await cleanDatabase(db);
  });

  afterAll(async () => {
    await db.closeConnection();
  });

  it("returns an empty page when no quarantined assets exist", async () => {
    const result = await repository.list({ page: 1, limit: 20 });
    expect(result.total).toBe(0);
    expect(result.data).toEqual([]);
    expect(result.lastPage).toBe(1);
  });
});
