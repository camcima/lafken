import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { LegalHoldQueryRepository } from "@/legal-holds/infrastructure/persistence/repositories/legal-hold-query.repository";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { cleanDatabase } from "../../helpers/clean-database";
import { createTestDatabaseClient } from "../../helpers/create-test-database-client";

describe("LegalHoldQueryRepository", () => {
  let db: DatabaseClient;
  let repository: LegalHoldQueryRepository;

  beforeAll(async () => {
    db = await createTestDatabaseClient();
    repository = new LegalHoldQueryRepository(db);
  });

  beforeEach(async () => {
    await cleanDatabase(db);
  });

  afterAll(async () => {
    await db.closeConnection();
  });

  it("returns an empty page when no legal holds exist", async () => {
    const result = await repository.list({ page: 1, limit: 20 });
    expect(result.total).toBe(0);
    expect(result.data).toEqual([]);
    expect(result.lastPage).toBe(1);
  });

  it("returns null for an id that does not exist", async () => {
    expect(await repository.findById("00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  it("returns 0 for countAffectedAssets when no assets are linked", async () => {
    const count = await repository.countAffectedAssets("00000000-0000-0000-0000-000000000000");
    expect(count).toBe(0);
  });
});
