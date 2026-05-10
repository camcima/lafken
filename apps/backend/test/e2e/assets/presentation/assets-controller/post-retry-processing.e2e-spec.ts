import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { mintDevOidcToken } from "../../../../__fixtures__/dev-oidc-token";
import { createAppModuleForE2ETest } from "../../../__fixtures__/app-module-factory";
import { truncateAllAssetTables } from "../../../common/database-cleanup.helper";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

const VALID_DB_POLICY_VALUES = {
  retention_days: null,
  retention_mode: "none",
  max_file_size_bytes: BigInt(52_428_800),
  allowed_mime_types: ["image/jpeg", "image/png", "image/webp"],
  exif_handling: "strip",
  virus_scan_required: true,
  content_moderation: null,
  required_metadata_schema: null,
  immutable: false,
  serving_mode: "signed",
  signed_url_ttl_seconds: 3600,
  signed_url_bucket_size: 300,
  retry_config: null,
  created_by: "ops@latam.com",
};

interface ISeededAsset {
  publicId: string;
  assetId: string;
}

describe("[E2E] POST /v1/assets/:id/retry-processing", () => {
  let app: INestApplication;
  let db: DatabaseClient;
  let storageBindingId: string;
  let namespaceId: string;
  let policyId: string;

  beforeAll(async () => {
    const fixture = await createAppModuleForE2ETest();
    app = fixture.appFixture;
    db = fixture.getDatabaseClient();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAllAssetTables(db);

    const bindingRow = await db.connection
      .insertInto("storage_bindings")
      .values({
        name: "test-binding",
        adapter_type: "gcs",
        config: { bucket: "lafken-dev", projectId: "fake-project-1" },
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    storageBindingId = bindingRow.id;

    await db.connection.transaction().execute(async (tx) => {
      const ns = await tx
        .insertInto("namespaces")
        .values({
          slug: "retry-test-ns",
          display_name: "Retry Test",
          current_policy_id: NIL_UUID,
          storage_binding_id: storageBindingId,
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      namespaceId = ns.id;

      const policy = await tx
        .insertInto("namespace_policies")
        .values({
          namespace_id: namespaceId,
          version: 1,
          ...VALID_DB_POLICY_VALUES,
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      policyId = policy.id;

      await tx
        .updateTable("namespaces")
        .set({ current_policy_id: policyId })
        .where("id", "=", namespaceId)
        .execute();
    });
  });

  async function seedAsset(state: "processing_failed" | "ready"): Promise<ISeededAsset> {
    return db.connection.transaction().execute(async (tx) => {
      const asset = await tx
        .insertInto("assets")
        .values({
          namespace_id: namespaceId,
          policy_version_id: policyId,
          state,
          state_reason: state === "processing_failed" ? "max_attempts_reached" : null,
          storage_binding_id: storageBindingId,
          storage_key: "uploads/retry-test.jpg",
          declared_mime_type: "image/jpeg",
          size_bytes: 42n,
          effective_max_size_bytes: 52_428_800n,
          effective_url_ttl: 3600,
          confirmed_at: new Date("2026-05-06T11:59:00.000Z"),
        })
        .returning(["id", "public_id"])
        .executeTakeFirstOrThrow();

      await tx
        .insertInto("processing_jobs")
        .values({
          asset_id: asset.id,
          state: state === "processing_failed" ? "failed" : "completed",
          worker_id: state === "processing_failed" ? "worker-stale" : null,
          attempt_number: state === "processing_failed" ? 4 : 1,
          last_error: state === "processing_failed" ? "boom" : null,
          last_error_at: state === "processing_failed" ? new Date() : null,
        })
        .execute();

      return { assetId: asset.id, publicId: asset.public_id };
    });
  }

  it("returns 200 and re-primes the processing job for a processing_failed asset", async () => {
    const { assetId } = await seedAsset("processing_failed");

    const response = await request(app.getHttpServer())
      .post(`/v1/assets/${assetId}/retry-processing`)
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "carlos.cima" })}`);

    expect(response.status).toBe(200);

    const asset = await db.connection
      .selectFrom("assets")
      .select(["state", "state_reason"])
      .where("id", "=", assetId)
      .executeTakeFirstOrThrow();
    expect(asset.state).toBe("uploaded");
    expect(asset.state_reason).toBe("retry_requested");

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
    expect(transition?.metadata).toMatchObject({
      reason_code: "retry_requested",
      requested_by: expect.any(String),
    });
    expect(transition?.occurred_by).toBeTruthy();

    const job = await db.connection
      .selectFrom("processing_jobs")
      .select(["state", "worker_id", "attempt_number", "last_error", "claimed_at", "heartbeat_at"])
      .where("asset_id", "=", assetId)
      .executeTakeFirstOrThrow();
    expect(job.state).toBe("released");
    expect(job.worker_id).toBeNull();
    expect(job.attempt_number).toBe(1);
    expect(job.last_error).toBeNull();
    expect(job.claimed_at).toBeNull();
    expect(job.heartbeat_at).toBeNull();
  });

  it("returns RFC 9457 422 when the asset is not in processing_failed", async () => {
    const { assetId, publicId } = await seedAsset("ready");

    const response = await request(app.getHttpServer())
      .post(`/v1/assets/${assetId}/retry-processing`)
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "carlos.cima" })}`);

    expect(response.status).toBe(422);
    expect(response.headers["content-type"]).toMatch(/application\/problem\+json/);
    expect(response.body.status).toBe(422);
    expect(typeof response.body.detail).toBe("string");
    expect(response.body.detail).toContain(publicId);
    expect(response.body.detail).toContain("processing_failed");
  });

  it("returns RFC 9457 404 when the publicId does not match any asset", async () => {
    const response = await request(app.getHttpServer())
      .post("/v1/assets/ffffffff-ffff-ffff-ffff-ffffffffffff/retry-processing")
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "carlos.cima" })}`);

    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toMatch(/application\/problem\+json/);
    expect(response.body.type).toMatch(/asset-not-found-error/);
    expect(response.body.status).toBe(404);
  });

  it("returns 403 when caller lacks PLATFORM_OPERATOR role", async () => {
    const { assetId } = await seedAsset("processing_failed");

    const response = await request(app.getHttpServer())
      .post(`/v1/assets/${assetId}/retry-processing`)
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "content-reviewer" })}`);

    expect(response.status).toBe(403);
  });
});
