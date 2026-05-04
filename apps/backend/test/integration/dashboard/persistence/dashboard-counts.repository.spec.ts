import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DashboardCountsRepository } from "@/dashboard/infrastructure/persistence/repositories/dashboard-counts.repository";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { createTestDatabaseClient } from "../../helpers/create-test-database-client";

describe("DashboardCountsRepository", () => {
  let db: DatabaseClient;
  let repository: DashboardCountsRepository;

  beforeAll(async () => {
    db = await createTestDatabaseClient();
    repository = new DashboardCountsRepository(db);
  });

  beforeEach(async () => {
    await db.connection.transaction().execute(async (tx) => {
      await tx.deleteFrom("asset_analyses").execute();
      await tx.deleteFrom("asset_state_transitions").execute();
      await tx.deleteFrom("processing_jobs").execute();
      await tx.deleteFrom("assets").execute();
      await tx.deleteFrom("legal_hold_assets").execute();
      await tx.deleteFrom("legal_holds").execute();
      await tx.deleteFrom("namespace_presets").execute();
      await tx.deleteFrom("namespace_policies").execute();
      await tx.deleteFrom("namespaces").execute();
    });
  });

  afterAll(async () => {
    await db.closeConnection();
  });

  it("returns all-zero counts when the database is empty", async () => {
    const counts = await repository.read();

    expect(counts).toEqual({
      totalAssets: 0,
      inFlight: 0,
      queueDepth: 0,
      quarantine: 0,
      legalHolds: 0,
      failedProcessing: 0,
      namespaces: 0,
    });
  });
});
