import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { NamespaceAlreadyExistsError } from "@/namespaces/domain/errors/namespace-already-exists.error";
import { StorageBindingMissingError } from "@/namespaces/domain/errors/storage-binding-missing.error";
import { NamespaceWriteRepository } from "@/namespaces/infrastructure/persistence/repositories/namespace-write.repository";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { cleanDatabase } from "../../helpers/clean-database";
import { createConnectionResolver } from "../../helpers/create-connection-resolver";
import { createTestDatabaseClient } from "../../helpers/create-test-database-client";

describe("NamespaceWriteRepository", () => {
  let db: DatabaseClient;
  let repository: NamespaceWriteRepository;

  beforeAll(async () => {
    db = await createTestDatabaseClient();
    repository = new NamespaceWriteRepository(db, createConnectionResolver(db));
  });

  beforeEach(async () => {
    await cleanDatabase(db);
  });

  afterAll(async () => {
    await db.closeConnection();
  });

  async function seedStorageBinding(): Promise<string> {
    const row = await db.connection
      .insertInto("storage_bindings")
      .values({ name: "test-binding", adapter_type: "gcs", config: { bucket: "test-bucket" } })
      .returningAll()
      .executeTakeFirstOrThrow();
    return (row as { id: string }).id;
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
    expect(typeof result.props.id).toBe("string");
    expect(result.props.id.length).toBeGreaterThan(0);
    expect(typeof result.props.currentPolicyId).toBe("string");
    expect(result.props.currentPolicyId.length).toBeGreaterThan(0);

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
      .where("namespace_id", "=", (nsRow as { id: string }).id)
      .executeTakeFirst();

    expect(policyRow).toBeDefined();
    expect((policyRow as { version: number }).version).toBe(1);
    expect((nsRow as { current_policy_id: string }).current_policy_id).toBe(
      (policyRow as { id: string }).id,
    );
  });

  it("throws StorageBindingMissingError when the storage binding does not exist, and rolls back — leaving no policy row", async () => {
    const nonExistentBindingId = "00000000-0000-0000-0000-000000000000";

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

  it("translates duplicate slugs into a domain error", async () => {
    const storageBindingId = await seedStorageBinding();
    await repository.createWithInitialPolicy({
      slug: "duplicate-slug",
      displayName: "Original",
      description: null,
      storageBindingId,
      policy: basePolicy,
      createdBy: null,
    });

    await expect(
      repository.createWithInitialPolicy({
        slug: "duplicate-slug",
        displayName: "Duplicate",
        description: null,
        storageBindingId,
        policy: basePolicy,
        createdBy: null,
      }),
    ).rejects.toBeInstanceOf(NamespaceAlreadyExistsError);
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

  it("clears description when updateMetadata is called with description: null", async () => {
    const bindingId = await seedStorageBinding();
    await repository.createWithInitialPolicy({
      slug: "aircraft-photos",
      displayName: "Aircraft Photos",
      description: "Some description",
      storageBindingId: bindingId,
      policy: basePolicy,
      createdBy: null,
    });

    await repository.updateMetadata({
      slug: "aircraft-photos",
      displayName: "Aircraft Photos",
      description: null,
    });

    const row = await db.connection
      .selectFrom("namespaces")
      .selectAll()
      .where("slug", "=", "aircraft-photos")
      .executeTakeFirstOrThrow();
    expect((row as { description: string | null }).description).toBeNull();
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
