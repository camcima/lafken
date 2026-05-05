import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";
import { StorageBinding } from "@/system/domain/entities/storage-binding.entity";
import { StorageBindingWriteRepository } from "@/system/infrastructure/persistence/repositories/storage-binding-write.repository";

import { createTestDatabaseClient } from "../../helpers/create-test-database-client";

describe("StorageBindingWriteRepository", () => {
  let db: DatabaseClient;
  let repository: StorageBindingWriteRepository;

  beforeAll(async () => {
    db = await createTestDatabaseClient();
    repository = new StorageBindingWriteRepository(db);
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

  it("inserts a new binding row and returns it with an assigned id and timestamps", async () => {
    const binding = StorageBinding.fromProps({
      id: "00000000-0000-0000-0000-000000000000",
      name: "new-binding",
      adapterType: "gcs",
      config: { bucket: "my-bucket" },
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });

    const result = await repository.insert(binding);

    expect(typeof result.props.id).toBe("string");
    expect(result.props.id.length).toBeGreaterThan(0);
    expect(result.props.name).toBe("new-binding");
    expect(result.props.adapterType).toBe("gcs");
    expect(result.props.config).toEqual({ bucket: "my-bucket" });
    expect(result.props.createdAt).toBeInstanceOf(Date);
    expect(result.props.updatedAt).toBeInstanceOf(Date);

    const row = await db.connection
      .selectFrom("storage_bindings")
      .selectAll()
      .where("name", "=", "new-binding")
      .executeTakeFirst();

    expect(row).toBeDefined();
    expect(row!.adapter_type).toBe("gcs");
    expect(row!.config).toEqual({ bucket: "my-bucket" });
  });

  it("updates an existing row's config", async () => {
    await db.connection
      .insertInto("storage_bindings")
      .values({ name: "to-update", adapter_type: "gcs", config: { bucket: "old-bucket" } })
      .execute();

    const binding = StorageBinding.fromProps({
      id: "00000000-0000-0000-0000-000000000000",
      name: "to-update",
      adapterType: "gcs",
      config: { bucket: "new-bucket" },
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });

    const result = await repository.update(binding);

    expect(result.props.name).toBe("to-update");
    expect(result.props.adapterType).toBe("gcs");
    expect(result.props.config).toEqual({ bucket: "new-bucket" });

    const row = await db.connection
      .selectFrom("storage_bindings")
      .selectAll()
      .where("name", "=", "to-update")
      .executeTakeFirst();

    expect(row).toBeDefined();
    expect(row!.config).toEqual({ bucket: "new-bucket" });
  });

  it("throws when updating a row that does not exist", async () => {
    const binding = StorageBinding.fromProps({
      id: "00000000-0000-0000-0000-000000000000",
      name: "missing",
      adapterType: "gcs",
      config: { bucket: "any-bucket" },
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });

    await expect(repository.update(binding)).rejects.toThrow();
  });

  it("deletes by name", async () => {
    await db.connection
      .insertInto("storage_bindings")
      .values({ name: "to-delete", adapter_type: "gcs", config: {} })
      .execute();

    await repository.delete("to-delete");

    const row = await db.connection
      .selectFrom("storage_bindings")
      .selectAll()
      .where("name", "=", "to-delete")
      .executeTakeFirst();

    expect(row).toBeUndefined();
  });

  it("is a no-op when deleting a name that does not exist", async () => {
    await expect(repository.delete("ghost")).resolves.toBeUndefined();

    const rows = await db.connection.selectFrom("storage_bindings").selectAll().execute();
    expect(rows).toHaveLength(0);
  });
});
