import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { QuarantineQueryRepository } from "@/quarantine/infrastructure/persistence/repositories/quarantine-query.repository";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { createTestDatabaseClient } from "../../helpers/create-test-database-client";

describe("QuarantineQueryRepository", () => {
  let db: DatabaseClient;
  let repository: QuarantineQueryRepository;

  beforeAll(async () => {
    db = await createTestDatabaseClient();
    repository = new QuarantineQueryRepository(db);
  });

  beforeEach(async () => {
    await db.connection.transaction().execute(async (tx) => {
      await tx.deleteFrom("legal_hold_assets").execute();
      await tx.deleteFrom("asset_analyses").execute();
      await tx.deleteFrom("asset_state_transitions").execute();
      await tx.deleteFrom("processing_jobs").execute();
      await tx.deleteFrom("assets").execute();
    });
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
