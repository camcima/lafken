import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";
import { StorageBindingQueryRepository } from "@/system/infrastructure/persistence/repositories/storage-binding-query.repository";

import { createTestDatabaseClient } from "../../helpers/create-test-database-client";

describe("StorageBindingQueryRepository", () => {
  let db: DatabaseClient;
  let repository: StorageBindingQueryRepository;

  beforeAll(async () => {
    db = await createTestDatabaseClient();
    repository = new StorageBindingQueryRepository(db);
  });

  beforeEach(async () => {
    // Clean storage_bindings; also remove namespaces that reference them first
    await db.connection.transaction().execute(async (tx) => {
      await tx.deleteFrom("namespace_presets").execute();
      await tx.deleteFrom("assets").execute();
      await tx.deleteFrom("namespace_policies").execute();
      await tx.deleteFrom("namespaces").execute();
      await tx.deleteFrom("storage_bindings").execute();
    });
  });

  afterAll(async () => {
    await db.closeConnection();
  });

  it("returns an empty list when no storage bindings exist", async () => {
    const result = await repository.list();
    expect(result).toEqual([]);
  });

  it("returns null for a name that does not exist", async () => {
    const result = await repository.findByName("missing");
    expect(result).toBeNull();
  });

  it("retrieves a GCS storage binding by name", async () => {
    await db.connection
      .insertInto("storage_bindings")
      .values({ name: "test-binding", adapter_type: "gcs", config: { bucket: "my-bucket" } })
      .execute();

    const found = await repository.findByName("test-binding");
    expect(found).not.toBeNull();
    expect(found!.props.name).toBe("test-binding");
    expect(found!.props.adapterType).toBe("gcs");
    expect(found!.props.config).toEqual({ bucket: "my-bucket" });
  });

  it("lists all storage bindings ordered by name", async () => {
    await db.connection
      .insertInto("storage_bindings")
      .values([
        { name: "z-binding", adapter_type: "gcs", config: {} },
        { name: "a-binding", adapter_type: "gcs", config: {} },
      ])
      .execute();

    const result = await repository.list();
    expect(result).toHaveLength(2);
    expect(result[0].props.name).toBe("a-binding");
    expect(result[1].props.name).toBe("z-binding");
  });
});
