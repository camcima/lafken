import { sql } from "kysely";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { UploadIntentConsumeConflictError } from "@/assets/domain/errors/upload-intent-consume-conflict.error";
import { AssetWriteRepository } from "@/assets/infrastructure/persistence/repositories/asset-write.repository";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { cleanDatabase } from "../../helpers/clean-database";
import { createConnectionResolver } from "../../helpers/create-connection-resolver";
import { createTestDatabaseClient } from "../../helpers/create-test-database-client";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolveFn: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    resolveFn = resolve;
  });
  return { promise, resolve: resolveFn };
}

describe("AssetWriteRepository", () => {
  let db: DatabaseClient; // connection A: repository under test
  let dbConcurrent: DatabaseClient; // connection B: the racing writer
  let repository: AssetWriteRepository;

  let bindingId: string;
  let namespaceId: string;
  let policyVersionId: string;
  let intentPublicId: string;

  beforeAll(async () => {
    db = await createTestDatabaseClient();
    dbConcurrent = await createTestDatabaseClient();
    repository = new AssetWriteRepository(db, createConnectionResolver(db));
  });

  afterAll(async () => {
    await db.closeConnection();
    await dbConcurrent.closeConnection();
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

  it("createUploadedAsset persists optional width and height when provided", async () => {
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
      width: 100,
      height: 50,
    });

    expect(asset.props.width).toBe(100);
    expect(asset.props.height).toBe(50);

    const assetRows = await db.connection
      .selectFrom("assets")
      .select(["width", "height"])
      .where("public_id", "=", intentPublicId)
      .execute();
    expect(assetRows).toHaveLength(1);
    expect((assetRows[0] as { width: number | null }).width).toBe(100);
    expect((assetRows[0] as { height: number | null }).height).toBe(50);
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

  function baseCreateInput() {
    return {
      publicId: intentPublicId,
      namespaceId,
      policyVersionId,
      storageBindingId: bindingId,
      storageKey: "uploads/test-asset.jpg",
      declaredMimeType: "image/jpeg",
      declaredSizeBytes: 4096n,
      uploadedBy: null,
      effectiveMaxSizeBytes: 52_428_800n,
      effectiveUrlTtl: 3600,
      intentId: intentPublicId,
    };
  }

  it("createUploadedAsset throws UploadIntentConsumeConflictError when the intent is already consumed", async () => {
    await db.connection
      .updateTable("upload_intents")
      .set({ consumed_at: new Date() })
      .where("public_id", "=", intentPublicId)
      .execute();

    await expect(repository.createUploadedAsset(baseCreateInput())).rejects.toBeInstanceOf(
      UploadIntentConsumeConflictError,
    );
  });

  it("createUploadedAsset rolls back the asset insert when the intent was expired by the sweeper", async () => {
    await db.connection
      .updateTable("upload_intents")
      .set({ expired_at: new Date() })
      .where("public_id", "=", intentPublicId)
      .execute();

    await expect(repository.createUploadedAsset(baseCreateInput())).rejects.toBeInstanceOf(
      UploadIntentConsumeConflictError,
    );
    const assets = await db.connection.selectFrom("assets").selectAll().execute();
    expect(assets).toHaveLength(0);
  });

  async function seedAssetInState(state: string): Promise<{ id: string; publicId: string }> {
    const row = await db.connection
      .insertInto("assets")
      .values({
        namespace_id: namespaceId,
        policy_version_id: policyVersionId,
        storage_binding_id: bindingId,
        storage_key: "uploads/cas-test.jpg",
        state,
        declared_mime_type: "image/jpeg",
        size_bytes: 4096n,
        effective_max_size_bytes: 52_428_800n,
        effective_url_ttl: 3600,
      })
      .returning(["id", "public_id"])
      .executeTakeFirstOrThrow();
    return { id: (row as { id: string }).id, publicId: (row as { public_id: string }).public_id };
  }

  it("transitionState applies the transition when expectedFromState matches", async () => {
    const seeded = await seedAssetInState("quarantined_virus");

    const updated = await repository.transitionState({
      publicId: seeded.publicId,
      toState: "ready",
      reason: "released_from_quarantine",
      by: "reviewer@latam.com",
      expectedFromState: "quarantined_virus",
    });

    expect(updated).not.toBeNull();
    expect(updated?.props.state).toBe("ready");

    const dbRow = await db.connection
      .selectFrom("assets")
      .select(["state"])
      .where("id", "=", seeded.id)
      .executeTakeFirstOrThrow();
    expect((dbRow as { state: string }).state).toBe("ready");

    const transitions = await db.connection
      .selectFrom("asset_state_transitions")
      .select(["from_state", "to_state"])
      .where("asset_id", "=", seeded.id)
      .execute();
    expect(transitions).toHaveLength(1);
    expect(transitions[0]).toMatchObject({ from_state: "quarantined_virus", to_state: "ready" });
  });

  it("transitionState returns null and writes nothing when expectedFromState does not match", async () => {
    const seeded = await seedAssetInState("ready");

    const updated = await repository.transitionState({
      publicId: seeded.publicId,
      toState: "rejected",
      reason: "rejected_from_quarantine: stale reviewer tab",
      by: "reviewer@latam.com",
      expectedFromState: "quarantined_virus",
    });

    expect(updated).toBeNull();

    const dbRow = await db.connection
      .selectFrom("assets")
      .select(["state"])
      .where("id", "=", seeded.id)
      .executeTakeFirstOrThrow();
    expect((dbRow as { state: string }).state).toBe("ready");

    const transitions = await db.connection
      .selectFrom("asset_state_transitions")
      .selectAll()
      .where("asset_id", "=", seeded.id)
      .execute();
    expect(transitions).toHaveLength(0);
  });

  /**
   * Polls pg_stat_activity until the repository's UPDATE on `assets` is
   * blocked waiting on the concurrent writer's row lock. Deterministic: the
   * UPDATE cannot proceed until the writer's transaction commits (or rolls
   * back), so once observed blocked, ordering across the two connections is
   * guaranteed — the repo's UPDATE is proven to run its predicate check
   * against the row version left by the writer, not the pre-race version.
   */
  async function waitForBlockedAssetUpdate(): Promise<void> {
    for (let i = 0; i < 200; i += 1) {
      const result = await sql<{ pid: number }>`
        SELECT pid FROM pg_stat_activity
        WHERE state = 'active'
          AND wait_event_type = 'Lock'
          AND query ILIKE 'update "assets"%'
      `.execute(db.connection);
      if (result.rows.length > 0) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error("assets UPDATE never blocked on the concurrent writer's lock");
  }

  /**
   * Starts a transaction on connection B that updates the given asset row to
   * `state` and holds the transaction open (row lock held) until `release()`
   * is called. `applied` resolves once the UPDATE has been sent and the row
   * lock acquired — callers must await it before starting the repo call
   * under test, otherwise the two connections race and the (previously
   * unused, "cold") connection B transaction can lose to connection A's
   * already-warm pool, letting the repo call finish before B's UPDATE ever
   * lands. Committing only happens on `release()`, so a plain (lock-free)
   * SELECT from another session still sees the pre-race committed state
   * until then — exactly the TOCTOU window this test needs.
   */
  function startConcurrentStateWriter(
    assetId: string,
    state: string,
  ): { applied: Promise<void>; done: Promise<void>; release: () => void } {
    const gate = deferred();
    const applied = deferred();
    const done = dbConcurrent.connection.transaction().execute(async (tx) => {
      await tx
        .updateTable("assets")
        .set({ state, state_changed_at: new Date() })
        .where("id", "=", assetId)
        .execute();
      applied.resolve();
      await gate.promise;
    });
    return { applied: applied.promise, done, release: gate.resolve };
  }

  it("transitionState re-checks the CAS predicate against the row version left by a concurrent writer (true TOCTOU race)", async () => {
    // Seed the asset in the state both racers believe is current. The repo's
    // SELECT will read this committed value before the writer's UPDATE lands.
    const seeded = await seedAssetInState("quarantined_virus");

    // Connection B "wins" the race: it commits a transition to `ready` in the
    // window between the repo's SELECT and its UPDATE.
    const writer = startConcurrentStateWriter(seeded.id, "ready");
    await writer.applied; // writer's UPDATE has landed and holds the row lock (uncommitted)

    // Connection A: the repo call under test. Its internal SELECT still reads
    // the committed "quarantined_virus" (writer's UPDATE is uncommitted, so
    // MVCC hides it from a plain read), so it passes the pre-check — the
    // only thing that can now reject it is the UPDATE's own
    // `WHERE state = expectedFromState` re-evaluating against the writer's
    // row version once the writer commits.
    const attempt = repository.transitionState({
      publicId: seeded.publicId,
      toState: "rejected",
      reason: "rejected_from_quarantine: stale reviewer tab",
      by: "reviewer@latam.com",
      expectedFromState: "quarantined_virus",
    });

    await waitForBlockedAssetUpdate();
    writer.release();
    await writer.done;

    const updated = await attempt;

    // The repo must lose the race: its UPDATE's WHERE re-evaluates against
    // the writer's committed "ready" state and matches zero rows.
    expect(updated).toBeNull();

    // The writer's state must stand — the repo must not have overwritten it.
    const dbRow = await db.connection
      .selectFrom("assets")
      .select(["state"])
      .where("id", "=", seeded.id)
      .executeTakeFirstOrThrow();
    expect((dbRow as { state: string }).state).toBe("ready");

    // The repo must not have written a transition row for the race it lost.
    const transitions = await db.connection
      .selectFrom("asset_state_transitions")
      .selectAll()
      .where("asset_id", "=", seeded.id)
      .execute();
    expect(transitions).toHaveLength(0);
  });
});
