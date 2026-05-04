import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { StorageBindingMissingError } from "@/namespaces/domain/errors/storage-binding-missing.error";
import { NamespaceWriteRepository } from "@/namespaces/infrastructure/persistence/repositories/namespace-write.repository";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { createTestDatabaseClient } from "../../helpers/create-test-database-client";

describe("NamespaceWriteRepository", () => {
  let db: DatabaseClient;
  let repository: NamespaceWriteRepository;

  beforeAll(async () => {
    db = await createTestDatabaseClient();
    repository = new NamespaceWriteRepository(db);
  });

  beforeEach(async () => {
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

  async function seedStorageBinding(): Promise<bigint> {
    const row = await db.connection
      .insertInto("storage_bindings")
      .values({ name: "test-binding", adapter_type: "gcs", config: { bucket: "test-bucket" } })
      .returningAll()
      .executeTakeFirstOrThrow();
    return BigInt((row as { id: bigint }).id);
  }

  const basePolicy = {
    retentionDays: 365,
    retentionMode: "delete" as const,
    maxFileSizeBytes: BigInt(50_000_000),
    allowedMimeTypes: ["image/jpeg", "image/png"],
    exifHandling: "strip" as const,
    virusScanRequired: true,
    contentModeration: null,
    requiredMetadataSchema: null,
    immutable: false,
    servingMode: "public" as const,
    signedUrlTtlSeconds: null,
    signedUrlBucketSize: null,
    retryConfig: null,
  };

  it("creates a namespace and initial policy v1 atomically, with current_policy_id pointing at the policy", async () => {
    const storageBindingId = await seedStorageBinding();

    const result = await repository.createWithInitialPolicy({
      slug: "aircraft-photos",
      displayName: "Aircraft Photos",
      description: "All aircraft imagery",
      storageBindingId,
      policy: basePolicy,
      createdBy: "alice",
    });

    expect(result.props.slug.value).toBe("aircraft-photos");
    expect(result.props.displayName).toBe("Aircraft Photos");
    expect(result.props.description).toBe("All aircraft imagery");
    expect(result.props.storageBindingId).toBe(storageBindingId);
    expect(result.props.archivedAt).toBeNull();
    expect(result.props.id).toBeGreaterThan(0n);
    expect(result.props.currentPolicyId).toBeGreaterThan(0n);

    // Verify via raw SQL that the policy row exists and is version 1
    const nsRow = await db.connection
      .selectFrom("namespaces")
      .selectAll()
      .where("slug", "=", "aircraft-photos")
      .executeTakeFirst();

    expect(nsRow).toBeDefined();

    const policyRow = await db.connection
      .selectFrom("namespace_policies")
      .selectAll()
      .where("namespace_id", "=", BigInt((nsRow as { id: bigint }).id))
      .executeTakeFirst();

    expect(policyRow).toBeDefined();
    expect((policyRow as { version: number }).version).toBe(1);
    expect(BigInt((nsRow as { current_policy_id: bigint }).current_policy_id)).toBe(
      BigInt((policyRow as { id: bigint }).id),
    );
  });

  it("throws StorageBindingMissingError when the storage binding does not exist, and rolls back — leaving no policy row", async () => {
    const nonExistentBindingId = BigInt(999_999_999);

    await expect(
      repository.createWithInitialPolicy({
        slug: "orphan-ns",
        displayName: "Orphan",
        description: null,
        storageBindingId: nonExistentBindingId,
        policy: basePolicy,
        createdBy: null,
      }),
    ).rejects.toThrow(StorageBindingMissingError);

    // Transaction must have rolled back — no namespace or policy rows must exist
    const nsCnt = await db.connection
      .selectFrom("namespaces")
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .executeTakeFirstOrThrow();
    expect(Number((nsCnt as { count: string }).count)).toBe(0);

    const polCnt = await db.connection
      .selectFrom("namespace_policies")
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .executeTakeFirstOrThrow();
    expect(Number((polCnt as { count: string }).count)).toBe(0);
  });

  it("updates display_name and description", async () => {
    const storageBindingId = await seedStorageBinding();

    await repository.createWithInitialPolicy({
      slug: "photos",
      displayName: "Photos",
      description: "Original",
      storageBindingId,
      policy: basePolicy,
      createdBy: null,
    });

    const updated = await repository.updateMetadata({
      slug: "photos",
      displayName: "Updated Photos",
      description: "New description",
    });

    expect(updated.props.displayName).toBe("Updated Photos");
    expect(updated.props.description).toBe("New description");

    const row = await db.connection
      .selectFrom("namespaces")
      .selectAll()
      .where("slug", "=", "photos")
      .executeTakeFirstOrThrow();

    expect((row as { display_name: string }).display_name).toBe("Updated Photos");
    expect((row as { description: string | null }).description).toBe("New description");
  });

  it("archives a namespace by setting archived_at to a non-null timestamp", async () => {
    const storageBindingId = await seedStorageBinding();

    await repository.createWithInitialPolicy({
      slug: "to-archive",
      displayName: "To Archive",
      description: null,
      storageBindingId,
      policy: basePolicy,
      createdBy: null,
    });

    const before = new Date();
    const archived = await repository.archive("to-archive");
    const after = new Date();

    expect(archived.props.archivedAt).not.toBeNull();
    expect(archived.props.archivedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(archived.props.archivedAt!.getTime()).toBeLessThanOrEqual(after.getTime());

    const row = await db.connection
      .selectFrom("namespaces")
      .selectAll()
      .where("slug", "=", "to-archive")
      .executeTakeFirstOrThrow();

    expect((row as { archived_at: Date | null }).archived_at).not.toBeNull();
  });

  it("unarchives a namespace by clearing archived_at to null", async () => {
    const storageBindingId = await seedStorageBinding();

    await repository.createWithInitialPolicy({
      slug: "to-unarchive",
      displayName: "To Unarchive",
      description: null,
      storageBindingId,
      policy: basePolicy,
      createdBy: null,
    });

    await repository.archive("to-unarchive");
    const unarchived = await repository.unarchive("to-unarchive");

    expect(unarchived.props.archivedAt).toBeNull();

    const row = await db.connection
      .selectFrom("namespaces")
      .selectAll()
      .where("slug", "=", "to-unarchive")
      .executeTakeFirstOrThrow();

    expect((row as { archived_at: Date | null }).archived_at).toBeNull();
  });
});
