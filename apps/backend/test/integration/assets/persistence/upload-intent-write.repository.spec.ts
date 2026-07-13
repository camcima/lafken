import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { UploadIntentWriteRepository } from "@/assets/infrastructure/persistence/repositories/upload-intent-write.repository";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { cleanDatabase } from "../../helpers/clean-database";
import { createTestDatabaseClient } from "../../helpers/create-test-database-client";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

describe("UploadIntentWriteRepository", () => {
  let db: DatabaseClient;
  let repository: UploadIntentWriteRepository;

  let bindingId: string;
  let namespaceId: string;
  let policyVersionId: string;

  beforeAll(async () => {
    db = await createTestDatabaseClient();
    repository = new UploadIntentWriteRepository(db);
  });

  afterAll(async () => {
    await db.closeConnection();
  });

  beforeEach(async () => {
    await cleanDatabase(db);

    // Seed storage binding
    const sb = await db.connection
      .insertInto("storage_bindings")
      .values({ name: "test-binding", adapter_type: "gcs", config: { bucket: "lafken-dev" } })
      .returning("id")
      .executeTakeFirstOrThrow();
    bindingId = (sb as { id: string }).id;

    // Seed namespace + policy in one transaction (deferrable FK on current_policy_id)
    const seeded = await db.connection.transaction().execute(async (tx) => {
      const ns = await tx
        .insertInto("namespaces")
        .values({
          slug: "aircraft-photos",
          display_name: "Aircraft Photos",
          description: null,
          current_policy_id: NIL_UUID,
          storage_binding_id: bindingId,
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      const nsId = (ns as { id: string }).id;

      const policy = await tx
        .insertInto("namespace_policies")
        .values({
          namespace_id: nsId,
          version: 1,
          retention_days: null,
          retention_mode: "none",
          max_file_size_bytes: 52_428_800n,
          allowed_mime_types: ["image/jpeg"],
          exif_handling: "strip",
          virus_scan_required: false,
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
      const pvId = (policy as { id: string }).id;

      await tx
        .updateTable("namespaces")
        .set({ current_policy_id: pvId })
        .where("id", "=", nsId)
        .execute();

      return { namespaceId: nsId, policyVersionId: pvId };
    });

    namespaceId = seeded.namespaceId;
    policyVersionId = seeded.policyVersionId;
  });

  it("insert persists an upload intent row and returns the domain entity", async () => {
    const futureExpiry = new Date(Date.now() + 3600 * 1000);
    const intent = await repository.insert({
      publicId: NIL_UUID,
      namespaceId,
      policyVersionId,
      storageBindingId: bindingId,
      storageKey: "uploads/test-key.jpg",
      declaredMimeType: "image/jpeg",
      declaredSizeBytes: 1024n,
      uploadUrl: "https://storage.example.com/signed",
      uploadUrlExpiresAt: futureExpiry,
      createdBy: "ops@latam.com",
    });

    expect(intent.props.storageKey).toBe("uploads/test-key.jpg");
    expect(intent.props.declaredMimeType).toBe("image/jpeg");
    expect(intent.props.declaredSizeBytes).toBe(1024n);
    expect(intent.props.consumedAt).toBeNull();
    expect(intent.props.createdBy).toBe("ops@latam.com");

    // Assert via direct DB query
    const rows = await db.connection
      .selectFrom("upload_intents")
      .selectAll()
      .where("public_id", "=", NIL_UUID)
      .execute();
    expect(rows).toHaveLength(1);
    expect((rows[0] as { storage_key: string }).storage_key).toBe("uploads/test-key.jpg");
    expect((rows[0] as { consumed_at: Date | null }).consumed_at).toBeNull();
  });

  it("findByPublicId returns null for a non-existent public_id", async () => {
    const result = await repository.findByPublicId("11111111-1111-1111-1111-111111111111");
    expect(result).toBeNull();
  });

  it("findByPublicId returns null for an invalid (non-UUID) string", async () => {
    const result = await repository.findByPublicId("not-a-uuid");
    expect(result).toBeNull();
  });

  it("findByPublicId returns the entity after insert", async () => {
    const futureExpiry = new Date(Date.now() + 3600 * 1000);
    await repository.insert({
      publicId: NIL_UUID,
      namespaceId,
      policyVersionId,
      storageBindingId: bindingId,
      storageKey: "uploads/find-me.jpg",
      declaredMimeType: "image/jpeg",
      declaredSizeBytes: 2048n,
      uploadUrl: "https://storage.example.com/signed",
      uploadUrlExpiresAt: futureExpiry,
      createdBy: null,
    });

    const found = await repository.findByPublicId(NIL_UUID);
    expect(found).not.toBeNull();
    expect(found!.props.storageKey).toBe("uploads/find-me.jpg");
    expect(found!.props.consumedAt).toBeNull();
  });

  it("markConsumed preserves the original consumed_at on a repeated call", async () => {
    const futureExpiry = new Date(Date.now() + 3600 * 1000);
    await repository.insert({
      publicId: NIL_UUID,
      namespaceId,
      policyVersionId,
      storageBindingId: bindingId,
      storageKey: "uploads/consume-me.jpg",
      declaredMimeType: "image/jpeg",
      declaredSizeBytes: 512n,
      uploadUrl: "https://storage.example.com/signed",
      uploadUrlExpiresAt: futureExpiry,
      createdBy: null,
    });

    // markConsumed takes no now/Clock argument, so this fakes the system
    // clock and advances it between the two calls — a re-consume that
    // blindly rewrote consumed_at would produce a visibly different
    // timestamp instead of only coincidentally matching the first call's.
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
      await repository.markConsumed(NIL_UUID);

      const firstRow = await db.connection
        .selectFrom("upload_intents")
        .selectAll()
        .where("public_id", "=", NIL_UUID)
        .executeTakeFirstOrThrow();
      const firstConsumedAt = (firstRow as { consumed_at: Date | null }).consumed_at;
      expect(firstConsumedAt).not.toBeNull();

      vi.setSystemTime(new Date("2026-01-01T01:00:00.000Z"));
      await repository.markConsumed(NIL_UUID);

      const secondRow = await db.connection
        .selectFrom("upload_intents")
        .selectAll()
        .where("public_id", "=", NIL_UUID)
        .executeTakeFirstOrThrow();
      const secondConsumedAt = (secondRow as { consumed_at: Date | null }).consumed_at;
      expect(secondConsumedAt).not.toBeNull();
      expect(secondConsumedAt!.getTime()).toBe(firstConsumedAt!.getTime());
    } finally {
      vi.useRealTimers();
    }
  });
});
