import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { AssetQueryRepository } from "@/assets/infrastructure/persistence/repositories/asset-query.repository";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { createTestDatabaseClient } from "../../helpers/create-test-database-client";

describe("AssetQueryRepository", () => {
  let db: DatabaseClient;
  let repository: AssetQueryRepository;

  beforeAll(async () => {
    db = await createTestDatabaseClient();
    repository = new AssetQueryRepository(db);
  });

  beforeEach(async () => {
    // Clean asset-related tables. Assets have FK dependencies on namespaces,
    // namespace_policies, and storage_bindings — we only clean the asset tables here.
    await db.connection.transaction().execute(async (tx) => {
      await tx.deleteFrom("asset_analyses").execute();
      await tx.deleteFrom("asset_state_transitions").execute();
      await tx.deleteFrom("processing_jobs").execute();
      await tx.deleteFrom("assets").execute();
    });
  });

  afterAll(async () => {
    await db.closeConnection();
  });

  it("returns an empty page when no assets exist", async () => {
    const result = await repository.list({ page: 1, limit: 20 });
    expect(result.total).toBe(0);
    expect(result.data).toEqual([]);
    expect(result.lastPage).toBe(1);
  });

  it("returns null for a public ID that does not exist", async () => {
    expect(await repository.findByPublicId("00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  it("returns null for a processing job when asset ID does not exist", async () => {
    expect(await repository.findProcessingJob("00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  it("returns null for a namespace slug when namespace ID does not exist", async () => {
    expect(await repository.findNamespaceSlug("00000000-0000-0000-0000-000000000000")).toBeNull();
  });
});
