import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { AssetProcessingRepository } from "@/assets/infrastructure/persistence/repositories/asset-processing.repository";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { cleanDatabase } from "../../helpers/clean-database";
import { createConnectionResolver } from "../../helpers/create-connection-resolver";
import { createTestDatabaseClient } from "../../helpers/create-test-database-client";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

describe("AssetProcessingRepository", () => {
  let db: DatabaseClient;
  let repository: AssetProcessingRepository;
  let assetId: string;

  beforeAll(async () => {
    db = await createTestDatabaseClient();
    repository = new AssetProcessingRepository(db, createConnectionResolver(db));
  });

  afterAll(async () => {
    await db.closeConnection();
  });

  beforeEach(async () => {
    await cleanDatabase(db);
    assetId = await seedUploadedAssetWithJob(db);
  });

  it("finds an asset with its processing policy", async () => {
    const result = await repository.findAssetWithPolicy(assetId);

    expect(result?.asset.props.id).toBe(assetId);
    expect(result?.policy.props.allowedMimeTypes).toEqual(["image/png"]);
    expect(result?.policy.props.virusScanRequired).toBe(true);
  });

  it("transitions asset state with a precondition and records timeline metadata", async () => {
    const transitioned = await repository.transitionAsset({
      assetId,
      fromState: "uploaded",
      toState: "processing",
      reason: "processing_started",
      metadata: { worker_id: "worker-a", job_attempt: 1, reason_code: "processing_started" },
      occurredBy: "worker:worker-a",
      now: new Date("2026-05-06T12:00:00.000Z"),
    });

    expect(transitioned).toBe(true);

    const asset = await db.connection
      .selectFrom("assets")
      .select(["state", "state_reason"])
      .where("id", "=", assetId)
      .executeTakeFirstOrThrow();

    expect(asset.state).toBe("processing");
    expect(asset.state_reason).toBe("processing_started");

    const transition = await db.connection
      .selectFrom("asset_state_transitions")
      .select(["from_state", "to_state", "reason", "metadata", "occurred_by"])
      .where("asset_id", "=", assetId)
      .executeTakeFirstOrThrow();

    expect(transition.from_state).toBe("uploaded");
    expect(transition.to_state).toBe("processing");
    expect(transition.reason).toBe("processing_started");
    expect(transition.occurred_by).toBe("worker:worker-a");
    expect(transition.metadata).toEqual({
      worker_id: "worker-a",
      job_attempt: 1,
      reason_code: "processing_started",
    });
  });

  it("restartProcessing flips processing_failed -> uploaded and re-primes the job", async () => {
    // Arrange: move the seeded asset to processing_failed and the job to failed.
    const failedAt = new Date("2026-05-06T11:00:00.000Z");
    await db.connection
      .updateTable("assets")
      .set({ state: "processing_failed", state_reason: "max_attempts_reached" })
      .where("id", "=", assetId)
      .execute();
    await db.connection
      .updateTable("processing_jobs")
      .set({
        state: "failed",
        worker_id: "worker-stale",
        claimed_at: failedAt,
        heartbeat_at: failedAt,
        attempt_number: 4,
        not_before: failedAt,
        last_error: "boom",
        last_error_at: failedAt,
      })
      .where("asset_id", "=", assetId)
      .execute();

    const now = new Date("2026-05-06T12:30:00.000Z");
    const restarted = await repository.restartProcessing({
      assetId,
      reason: "retry_requested",
      requestedByEmail: "ops@latam.com",
      now,
    });

    expect(restarted).toBe(true);

    const asset = await db.connection
      .selectFrom("assets")
      .select(["state", "state_reason", "state_changed_at"])
      .where("id", "=", assetId)
      .executeTakeFirstOrThrow();
    expect(asset.state).toBe("uploaded");
    expect(asset.state_reason).toBe("retry_requested");
    expect(asset.state_changed_at).toEqual(now);

    const transitions = await db.connection
      .selectFrom("asset_state_transitions")
      .select(["from_state", "to_state", "reason", "metadata", "occurred_by"])
      .where("asset_id", "=", assetId)
      .execute();
    expect(transitions).toHaveLength(1);
    const [transition] = transitions;
    expect(transition?.from_state).toBe("processing_failed");
    expect(transition?.to_state).toBe("uploaded");
    expect(transition?.reason).toBe("retry_requested");
    expect(transition?.occurred_by).toBe("ops@latam.com");
    expect(transition?.metadata).toEqual({
      reason_code: "retry_requested",
      requested_by: "ops@latam.com",
    });

    const job = await db.connection
      .selectFrom("processing_jobs")
      .select([
        "state",
        "worker_id",
        "claimed_at",
        "heartbeat_at",
        "current_step",
        "attempt_number",
        "not_before",
        "last_error",
        "last_error_at",
      ])
      .where("asset_id", "=", assetId)
      .executeTakeFirstOrThrow();
    expect(job.state).toBe("released");
    expect(job.worker_id).toBeNull();
    expect(job.claimed_at).toBeNull();
    expect(job.heartbeat_at).toBeNull();
    expect(job.current_step).toBeNull();
    expect(job.attempt_number).toBe(1);
    expect(job.not_before).toEqual(now);
    expect(job.last_error).toBeNull();
    expect(job.last_error_at).toBeNull();
  });

  it("restartProcessing returns false and does nothing when the asset is not in processing_failed", async () => {
    // Seeded asset is `uploaded` (precondition not met).
    const now = new Date("2026-05-06T12:30:00.000Z");

    const restarted = await repository.restartProcessing({
      assetId,
      reason: "retry_requested",
      requestedByEmail: "ops@latam.com",
      now,
    });

    expect(restarted).toBe(false);

    const asset = await db.connection
      .selectFrom("assets")
      .select(["state", "state_reason"])
      .where("id", "=", assetId)
      .executeTakeFirstOrThrow();
    expect(asset.state).toBe("uploaded");
    expect(asset.state_reason).toBeNull();

    const transitions = await db.connection
      .selectFrom("asset_state_transitions")
      .selectAll()
      .where("asset_id", "=", assetId)
      .execute();
    expect(transitions).toHaveLength(0);

    // Seeded job remains untouched (still `released`, attempt_number 1, no last_error).
    const job = await db.connection
      .selectFrom("processing_jobs")
      .select(["state", "attempt_number", "last_error", "worker_id"])
      .where("asset_id", "=", assetId)
      .executeTakeFirstOrThrow();
    expect(job.state).toBe("released");
    expect(job.attempt_number).toBe(1);
    expect(job.last_error).toBeNull();
    expect(job.worker_id).toBeNull();
  });

  it("updates derived metadata and records analysis evidence", async () => {
    const contentHash = Buffer.alloc(32, 3);
    const phash = Buffer.alloc(8, 7);

    await repository.updateDerivedMetadata({
      assetId,
      mimeType: "image/png",
      sizeBytes: 123n,
      width: 2,
      height: 3,
      contentHash,
      phash,
      captureContext: { captured_at: "2026-05-06T12:00:00.000Z" },
    });

    await repository.recordAnalysis({
      assetId,
      analyzer: "image_inspection",
      analyzerVersion: "sharp-v1",
      decision: "pass",
      findings: { duration_ms: 12 },
      occurredAt: new Date("2026-05-06T12:00:00.000Z"),
    });

    const asset = await db.connection
      .selectFrom("assets")
      .select([
        "mime_type",
        "size_bytes",
        "width",
        "height",
        "content_hash",
        "phash",
        "capture_context",
      ])
      .where("id", "=", assetId)
      .executeTakeFirstOrThrow();

    expect(asset.mime_type).toBe("image/png");
    expect(asset.size_bytes).toBe(123n);
    expect(asset.width).toBe(2);
    expect(asset.height).toBe(3);
    expect(Buffer.from(asset.content_hash as Buffer).toString("hex")).toBe(
      contentHash.toString("hex"),
    );
    expect(Buffer.from(asset.phash as Buffer).toString("hex")).toBe(phash.toString("hex"));
    expect(asset.capture_context).toEqual({ captured_at: "2026-05-06T12:00:00.000Z" });

    const analyses = await db.connection
      .selectFrom("asset_analyses")
      .select(["analyzer", "decision", "findings"])
      .where("asset_id", "=", assetId)
      .execute();

    expect(analyses).toHaveLength(1);
    expect(analyses[0]?.analyzer).toBe("image_inspection");
    expect(analyses[0]?.decision).toBe("pass");
    expect(analyses[0]?.findings).toEqual({ duration_ms: 12 });
  });
});

async function seedUploadedAssetWithJob(db: DatabaseClient): Promise<string> {
  return db.connection.transaction().execute(async (tx) => {
    const binding = await tx
      .insertInto("storage_bindings")
      .values({ name: "asset-processing-binding", adapter_type: "gcs", config: { bucket: "test" } })
      .returning("id")
      .executeTakeFirstOrThrow();

    const namespace = await tx
      .insertInto("namespaces")
      .values({
        slug: "asset-processing",
        display_name: "Asset Processing",
        description: null,
        current_policy_id: NIL_UUID,
        storage_binding_id: binding.id,
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    const policy = await tx
      .insertInto("namespace_policies")
      .values({
        namespace_id: namespace.id,
        version: 1,
        retention_days: null,
        retention_mode: "none",
        max_file_size_bytes: 52_428_800n,
        allowed_mime_types: ["image/png"],
        exif_handling: "strip",
        virus_scan_required: true,
        content_moderation: { threshold: 0.9 },
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

    await tx.updateTable("namespaces").set({ current_policy_id: policy.id }).execute();

    const asset = await tx
      .insertInto("assets")
      .values({
        namespace_id: namespace.id,
        policy_version_id: policy.id,
        state: "uploaded",
        storage_binding_id: binding.id,
        storage_key: "uploads/asset-processing.png",
        declared_mime_type: "image/png",
        size_bytes: 42n,
        effective_max_size_bytes: 52_428_800n,
        effective_url_ttl: 3600,
        confirmed_at: new Date("2026-05-06T11:59:00.000Z"),
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    await tx
      .insertInto("processing_jobs")
      .values({
        asset_id: asset.id,
        state: "released",
        attempt_number: 1,
        not_before: new Date("2026-05-06T11:59:00.000Z"),
      })
      .execute();

    return asset.id;
  });
}
