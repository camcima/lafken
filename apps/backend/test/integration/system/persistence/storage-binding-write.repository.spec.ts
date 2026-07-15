import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";
import { StorageBinding } from "@/system/domain/entities/storage-binding.entity";
import { DuplicateStorageBindingNameError } from "@/system/domain/errors/duplicate-storage-binding-name.error";
import { StorageBindingInUseError } from "@/system/domain/errors/storage-binding-in-use.error";
import { StorageBindingWriteRepository } from "@/system/infrastructure/persistence/repositories/storage-binding-write.repository";

import { cleanDatabase } from "../../helpers/clean-database";
import { createTestDatabaseClient } from "../../helpers/create-test-database-client";

describe("StorageBindingWriteRepository", () => {
  let db: DatabaseClient;
  let repository: StorageBindingWriteRepository;

  beforeAll(async () => {
    db = await createTestDatabaseClient();
    repository = new StorageBindingWriteRepository(db);
  });

  beforeEach(async () => {
    await cleanDatabase(db);
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

  it("translates duplicate binding names into a domain error", async () => {
    await db.connection
      .insertInto("storage_bindings")
      .values({ name: "duplicate", adapter_type: "gcs", config: { bucket: "existing" } })
      .execute();

    const binding = StorageBinding.fromProps({
      id: "00000000-0000-0000-0000-000000000000",
      name: "duplicate",
      adapterType: "gcs",
      config: { bucket: "new" },
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });

    await expect(repository.insert(binding)).rejects.toBeInstanceOf(
      DuplicateStorageBindingNameError,
    );
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

  it("translates in-use binding deletes into a domain error", async () => {
    const binding = await db.connection
      .insertInto("storage_bindings")
      .values({ name: "in-use", adapter_type: "gcs", config: {} })
      .returning("id")
      .executeTakeFirstOrThrow();
    const storageBindingId = (binding as { id: string }).id;

    await db.connection.transaction().execute(async (tx) => {
      const namespace = await tx
        .insertInto("namespaces")
        .values({
          slug: "uses-binding",
          display_name: "Uses binding",
          description: null,
          current_policy_id: "00000000-0000-0000-0000-000000000000",
          storage_binding_id: storageBindingId,
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      const namespaceId = (namespace as { id: string }).id;

      const policy = await tx
        .insertInto("namespace_policies")
        .values({
          namespace_id: namespaceId,
          version: 1,
          retention_days: null,
          retention_mode: "none",
          max_file_size_bytes: 52_428_800n,
          allowed_mime_types: ["image/jpeg"],
          exif_handling: "strip",
          virus_scan_required: true,
          content_moderation: null,
          required_metadata_schema: null,
          immutable: false,
          serving_mode: "signed",
          signed_url_ttl_seconds: 3600,
          signed_url_bucket_size: 300,
          retry_config: null,
          created_by: null,
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      await tx
        .updateTable("namespaces")
        .set({ current_policy_id: (policy as { id: string }).id })
        .where("id", "=", namespaceId)
        .execute();
    });

    await expect(repository.delete("in-use")).rejects.toBeInstanceOf(StorageBindingInUseError);
  });

  it("is a no-op when deleting a name that does not exist", async () => {
    await expect(repository.delete("ghost")).resolves.toBeUndefined();

    const rows = await db.connection.selectFrom("storage_bindings").selectAll().execute();
    expect(rows).toHaveLength(0);
  });
});
