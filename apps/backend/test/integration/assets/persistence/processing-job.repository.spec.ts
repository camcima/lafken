import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ProcessingJobRepository } from "@/assets/infrastructure/persistence/repositories/processing-job.repository";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { createConnectionResolver } from "../../helpers/create-connection-resolver";
import { createTestDatabaseClient } from "../../helpers/create-test-database-client";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

describe("ProcessingJobRepository", () => {
  let db: DatabaseClient;
  let repository: ProcessingJobRepository;
  let assetId: string;

  beforeAll(async () => {
    db = await createTestDatabaseClient();
    repository = new ProcessingJobRepository(db, createConnectionResolver(db));
  });

  afterAll(async () => {
    await db.closeConnection();
  });

  beforeEach(async () => {
    await cleanDatabase(db);
    assetId = await seedUploadedAssetWithJob(db);
  });

  it("claims released due jobs with worker metadata", async () => {
    const jobs = await repository.claimAvailable({
      workerId: "worker-a",
      limit: 1,
      now: new Date("2026-05-06T12:00:00.000Z"),
    });

    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.props.state).toBe("claimed");
    expect(jobs[0]?.props.workerId).toBe("worker-a");

    const row = await db.connection
      .selectFrom("processing_jobs")
      .select(["state", "worker_id", "claimed_at", "heartbeat_at"])
      .where("asset_id", "=", assetId)
      .executeTakeFirstOrThrow();

    expect(row.state).toBe("claimed");
    expect(row.worker_id).toBe("worker-a");
    expect(row.claimed_at).not.toBeNull();
    expect(row.heartbeat_at).not.toBeNull();
  });

  it("does not claim jobs with future not_before", async () => {
    await db.connection
      .updateTable("processing_jobs")
      .set({ not_before: new Date("2026-05-06T12:05:00.000Z") })
      .where("asset_id", "=", assetId)
      .execute();

    const jobs = await repository.claimAvailable({
      workerId: "worker-a",
      limit: 1,
      now: new Date("2026-05-06T12:00:00.000Z"),
    });

    expect(jobs).toHaveLength(0);
  });

  it("heartbeats only when worker_id still matches", async () => {
    await repository.claimAvailable({
      workerId: "worker-a",
      limit: 1,
      now: new Date("2026-05-06T12:00:00.000Z"),
    });

    await expect(
      repository.heartbeat({
        assetId,
        workerId: "worker-a",
        now: new Date("2026-05-06T12:00:10.000Z"),
      }),
    ).resolves.toBe(true);

    await expect(
      repository.heartbeat({
        assetId,
        workerId: "worker-b",
        now: new Date("2026-05-06T12:00:20.000Z"),
      }),
    ).resolves.toBe(false);
  });

  describe("countDueJobs", () => {
    it("counts released and claimed jobs whose not_before has elapsed", async () => {
      // Seed three more jobs alongside the default released-and-due one
      // produced by `seedUploadedAssetWithJob`.
      const futureNotBefore = new Date("2026-05-06T13:00:00.000Z");
      const pastNotBefore = new Date("2026-05-06T11:55:00.000Z");

      const otherAssetIds: string[] = [];
      for (let i = 0; i < 3; i += 1) {
        otherAssetIds.push(await seedUploadedAssetWithJob(db, `count-due-${i}`));
      }

      // Job 0: future not_before → not due → excluded
      await db.connection
        .updateTable("processing_jobs")
        .set({ not_before: futureNotBefore, state: "released" })
        .where("asset_id", "=", otherAssetIds[0])
        .execute();
      // Job 1: claimed and past not_before → due → included
      await db.connection
        .updateTable("processing_jobs")
        .set({ not_before: pastNotBefore, state: "claimed", worker_id: "w-1" })
        .where("asset_id", "=", otherAssetIds[1])
        .execute();
      // Job 2: completed → excluded
      await db.connection
        .updateTable("processing_jobs")
        .set({ state: "completed" })
        .where("asset_id", "=", otherAssetIds[2])
        .execute();

      const count = await repository.countDueJobs({
        now: new Date("2026-05-06T12:00:00.000Z"),
      });

      // Default seeded job is released and due (not_before = 11:59), plus the
      // claimed-and-due Job 1 → 2 total.
      expect(count).toBe(2);
    });
  });

  it("releases claimed jobs for retry with backoff", async () => {
    await repository.claimAvailable({
      workerId: "worker-a",
      limit: 1,
      now: new Date("2026-05-06T12:00:00.000Z"),
    });

    await repository.releaseForRetry({
      assetId,
      workerId: "worker-a",
      attemptNumber: 2,
      notBefore: new Date("2026-05-06T12:01:00.000Z"),
      lastError: "storage timeout",
      now: new Date("2026-05-06T12:00:10.000Z"),
    });

    const row = await db.connection
      .selectFrom("processing_jobs")
      .select(["state", "worker_id", "attempt_number", "not_before", "last_error"])
      .where("asset_id", "=", assetId)
      .executeTakeFirstOrThrow();

    expect(row.state).toBe("released");
    expect(row.worker_id).toBeNull();
    expect(row.attempt_number).toBe(2);
    expect(row.last_error).toBe("storage timeout");
  });

  it("cancelForAsset completes a released job and records the cancel reason", async () => {
    const cancelled = await repository.cancelForAsset({
      assetId,
      reason: "asset_deleted",
      now: new Date("2026-05-06T12:00:00.000Z"),
    });

    expect(cancelled).toBe(true);
    const row = await db.connection
      .selectFrom("processing_jobs")
      .select(["state", "worker_id", "last_error"])
      .where("asset_id", "=", assetId)
      .executeTakeFirstOrThrow();
    expect(row.state).toBe("completed");
    expect(row.worker_id).toBeNull();
    expect(row.last_error).toBe("asset_deleted");
  });

  it("cancelForAsset also cancels a claimed job owned by a live worker", async () => {
    await repository.claimAvailable({
      workerId: "worker-a",
      limit: 1,
      now: new Date("2026-05-06T12:00:00.000Z"),
    });

    const cancelled = await repository.cancelForAsset({
      assetId,
      reason: "asset_deleted",
      now: new Date("2026-05-06T12:00:10.000Z"),
    });

    expect(cancelled).toBe(true);
  });

  it("cancelForAsset returns false when the job is already terminal", async () => {
    await db.connection
      .updateTable("processing_jobs")
      .set({ state: "completed" })
      .where("asset_id", "=", assetId)
      .execute();

    const cancelled = await repository.cancelForAsset({
      assetId,
      reason: "asset_deleted",
      now: new Date("2026-05-06T12:00:00.000Z"),
    });

    expect(cancelled).toBe(false);
  });
});

async function cleanDatabase(db: DatabaseClient): Promise<void> {
  await db.connection.transaction().execute(async (tx) => {
    await tx.deleteFrom("asset_analyses").execute();
    await tx.deleteFrom("asset_state_transitions").execute();
    await tx.deleteFrom("processing_jobs").execute();
    await tx.deleteFrom("legal_hold_assets").execute();
    await tx.deleteFrom("assets").execute();
    await tx.deleteFrom("upload_intents").execute();
    await tx.deleteFrom("namespace_presets").execute();
    await tx.deleteFrom("namespace_policies").execute();
    await tx.deleteFrom("namespaces").execute();
    await tx.deleteFrom("storage_bindings").execute();
  });
}

async function seedUploadedAssetWithJob(db: DatabaseClient, suffix = "default"): Promise<string> {
  return db.connection.transaction().execute(async (tx) => {
    const binding = await tx
      .insertInto("storage_bindings")
      .values({
        name: `processing-test-binding-${suffix}`,
        adapter_type: "gcs",
        config: { bucket: "test" },
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    const namespace = await tx
      .insertInto("namespaces")
      .values({
        slug: `processing-assets-${suffix}`,
        display_name: "Processing Assets",
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

    await tx
      .updateTable("namespaces")
      .set({ current_policy_id: policy.id })
      .where("id", "=", namespace.id)
      .execute();

    const asset = await tx
      .insertInto("assets")
      .values({
        namespace_id: namespace.id,
        policy_version_id: policy.id,
        state: "uploaded",
        storage_binding_id: binding.id,
        storage_key: `uploads/processing-test-${suffix}.png`,
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
