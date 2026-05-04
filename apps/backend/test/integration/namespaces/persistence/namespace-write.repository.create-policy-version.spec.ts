import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { NamespaceWriteRepository } from "@/namespaces/infrastructure/persistence/repositories/namespace-write.repository";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { createTestDatabaseClient } from "../../helpers/create-test-database-client";

describe("NamespaceWriteRepository.createPolicyVersion", () => {
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

  async function seedNamespaceV1(slug: string): Promise<bigint> {
    const storageBindingId = await seedStorageBinding();
    const namespace = await repository.createWithInitialPolicy({
      slug,
      displayName: "Test Namespace",
      description: null,
      storageBindingId,
      policy: basePolicy,
      createdBy: "seed@test.com",
    });
    return namespace.props.id;
  }

  it("inserts a new policy version (v2) and flips current_policy_id", async () => {
    const namespaceId = await seedNamespaceV1("test-ns");

    const result = await repository.createPolicyVersion({
      namespaceId,
      policy: { ...basePolicy, retentionDays: 90 },
      createdBy: "ops@latam.com",
    });

    expect(result.newPolicyVersion).toBe(2);

    // Verify two policy rows exist, ordered by version
    const policies = await db.connection
      .selectFrom("namespace_policies")
      .selectAll()
      .where("namespace_id", "=", namespaceId)
      .orderBy("version", "asc")
      .execute();

    expect(policies).toHaveLength(2);
    expect((policies[1] as { version: number }).version).toBe(2);
    expect((policies[1] as { retention_days: number }).retention_days).toBe(90);

    // Verify namespaces.current_policy_id points to v2
    const nsRow = await db.connection
      .selectFrom("namespaces")
      .selectAll()
      .where("id", "=", namespaceId)
      .executeTakeFirstOrThrow();

    expect(BigInt((nsRow as { current_policy_id: bigint }).current_policy_id)).toBe(
      BigInt((policies[1] as { id: bigint }).id),
    );
  });

  it("bumps version sequentially on multiple edits", async () => {
    const namespaceId = await seedNamespaceV1("multi-edit-ns");

    await repository.createPolicyVersion({
      namespaceId,
      policy: { ...basePolicy, retentionDays: 60 },
      createdBy: "ops@latam.com",
    });

    const result = await repository.createPolicyVersion({
      namespaceId,
      policy: { ...basePolicy, retentionDays: 30 },
      createdBy: "ops@latam.com",
    });

    expect(result.newPolicyVersion).toBe(3);

    const policies = await db.connection
      .selectFrom("namespace_policies")
      .selectAll()
      .where("namespace_id", "=", namespaceId)
      .orderBy("version", "asc")
      .execute();

    expect(policies).toHaveLength(3);
    expect((policies[2] as { version: number }).version).toBe(3);
    expect((policies[2] as { retention_days: number }).retention_days).toBe(30);
  });

  it("retries once on a unique_violation race and produces sequential versions", async () => {
    const namespaceId = await seedNamespaceV1("race-ns");

    // Pre-insert v2 directly to simulate a concurrent writer winning the race
    await db.connection
      .insertInto("namespace_policies")
      .values({
        namespace_id: namespaceId,
        version: 2,
        retention_days: 180,
        retention_mode: "delete",
        max_file_size_bytes: BigInt(50_000_000),
        allowed_mime_types: ["image/jpeg"],
        exif_handling: "strip",
        virus_scan_required: true,
        immutable: false,
        serving_mode: "public",
        created_by: "concurrent-writer@test.com",
      })
      .execute();

    // The repository should detect the unique violation, retry, and produce v3
    const result = await repository.createPolicyVersion({
      namespaceId,
      policy: basePolicy,
      createdBy: "ops@latam.com",
    });

    expect(result.newPolicyVersion).toBe(3);

    const policies = await db.connection
      .selectFrom("namespace_policies")
      .selectAll()
      .where("namespace_id", "=", namespaceId)
      .orderBy("version", "asc")
      .execute();

    expect(policies).toHaveLength(3);
    expect((policies[2] as { version: number }).version).toBe(3);
  });
});
