import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { AssetWriteRepository } from "@/assets/infrastructure/persistence/repositories/asset-write.repository";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { createTestDatabaseClient } from "../../helpers/create-test-database-client";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

describe("AssetWriteRepository", () => {
  let db: DatabaseClient;
  let repository: AssetWriteRepository;

  let bindingId: string;
  let namespaceId: string;
  let policyVersionId: string;
  let intentPublicId: string;

  beforeAll(async () => {
    db = await createTestDatabaseClient();
    repository = new AssetWriteRepository(db);
  });

  afterAll(async () => {
    await db.closeConnection();
  });

  beforeEach(async () => {
    // Clean in FK order (most dependent first)
    await db.connection.transaction().execute(async (tx) => {
      await tx.deleteFrom("asset_analyses").execute();
      await tx.deleteFrom("asset_state_transitions").execute();
      await tx.deleteFrom("processing_jobs").execute();
      await tx.deleteFrom("assets").execute();
      await tx.deleteFrom("upload_intents").execute();
      await tx.deleteFrom("namespace_presets").execute();
      await tx.deleteFrom("namespace_policies").execute();
      await tx.deleteFrom("namespaces").execute();
      await tx.deleteFrom("storage_bindings").execute();
    });

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

    // Seed an upload intent
    const futureExpiry = new Date(Date.now() + 3600 * 1000);
    const intent = await db.connection
      .insertInto("upload_intents")
      .values({
        public_id: NIL_UUID,
        namespace_id: namespaceId,
        policy_version_id: policyVersionId,
        storage_binding_id: bindingId,
        storage_key: "uploads/test-asset.jpg",
        declared_mime_type: "image/jpeg",
        declared_size_bytes: 4096n,
        upload_url: "https://storage.example.com/signed",
        upload_url_expires_at: futureExpiry,
        created_by: null,
      })
      .returning("public_id")
      .executeTakeFirstOrThrow();
    intentPublicId = (intent as { public_id: string }).public_id;
  });

  it("createUploadedAsset inserts all 4 rows and returns the asset domain entity", async () => {
    const asset = await repository.createUploadedAsset({
      publicId: intentPublicId,
      namespaceId,
      policyVersionId,
      storageBindingId: bindingId,
      storageKey: "uploads/test-asset.jpg",
      declaredMimeType: "image/jpeg",
      declaredSizeBytes: 4096n,
      uploadedBy: "ops@latam.com",
      effectiveMaxSizeBytes: 52_428_800n,
      effectiveUrlTtl: 3600,
      intentId: intentPublicId,
    });

    // Assert domain entity
    expect(asset.props.publicId).toBe(intentPublicId);
    expect(asset.props.state).toBe("uploaded");
    expect(asset.props.storageKey).toBe("uploads/test-asset.jpg");
    expect(asset.props.uploadedBy).toBe("ops@latam.com");

    // 1. Assert upload_intents.consumed_at was set
    const intentRows = await db.connection
      .selectFrom("upload_intents")
      .select(["consumed_at"])
      .where("public_id", "=", intentPublicId)
      .execute();
    expect(intentRows).toHaveLength(1);
    expect((intentRows[0] as { consumed_at: Date | null }).consumed_at).not.toBeNull();

    // 2. Assert asset row exists
    const assetRows = await db.connection
      .selectFrom("assets")
      .selectAll()
      .where("public_id", "=", intentPublicId)
      .execute();
    expect(assetRows).toHaveLength(1);
    expect((assetRows[0] as { state: string }).state).toBe("uploaded");

    const assetId = (assetRows[0] as { id: string }).id;

    // 3. Assert state transition row
    const transitionRows = await db.connection
      .selectFrom("asset_state_transitions")
      .selectAll()
      .where("asset_id", "=", assetId)
      .execute();
    expect(transitionRows).toHaveLength(1);
    expect((transitionRows[0] as { from_state: string | null }).from_state).toBeNull();
    expect((transitionRows[0] as { to_state: string }).to_state).toBe("uploaded");
    expect((transitionRows[0] as { reason: string }).reason).toBe("upload_confirmed");

    // 4. Assert processing_jobs row
    const jobRows = await db.connection
      .selectFrom("processing_jobs")
      .selectAll()
      .where("asset_id", "=", assetId)
      .execute();
    expect(jobRows).toHaveLength(1);
    expect((jobRows[0] as { state: string }).state).toBe("released");
    expect((jobRows[0] as { attempt_number: number }).attempt_number).toBe(1);
  });

  it("createUploadedAsset rolls back all rows when a FK constraint is violated", async () => {
    const BAD_POLICY_ID = "ffffffff-ffff-ffff-ffff-ffffffffffff";

    await expect(
      repository.createUploadedAsset({
        publicId: intentPublicId,
        namespaceId,
        policyVersionId: BAD_POLICY_ID, // FK violation — does not exist
        storageBindingId: bindingId,
        storageKey: "uploads/test-asset.jpg",
        declaredMimeType: "image/jpeg",
        declaredSizeBytes: 4096n,
        uploadedBy: null,
        effectiveMaxSizeBytes: 52_428_800n,
        effectiveUrlTtl: 3600,
        intentId: intentPublicId,
      }),
    ).rejects.toThrow();

    // After rollback: intent.consumed_at must still be null
    const intentRows = await db.connection
      .selectFrom("upload_intents")
      .select(["consumed_at"])
      .where("public_id", "=", intentPublicId)
      .execute();
    expect(intentRows).toHaveLength(1);
    expect((intentRows[0] as { consumed_at: Date | null }).consumed_at).toBeNull();

    // No asset rows must have been inserted
    const assetRows = await db.connection
      .selectFrom("assets")
      .selectAll()
      .where("public_id", "=", intentPublicId)
      .execute();
    expect(assetRows).toHaveLength(0);
  });
});
