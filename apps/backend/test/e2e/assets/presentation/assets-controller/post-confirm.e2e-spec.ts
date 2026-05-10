import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { mintDevOidcToken } from "../../../../__fixtures__/dev-oidc-token";
import { createAppModuleForE2ETest } from "../../../__fixtures__/app-module-factory";
import { truncateAllAssetTables } from "../../../common/database-cleanup.helper";

// This suite requires fake-gcs to be running because confirm-upload must round-trip
// a real PUT to the signed URL and then call objectExists against fake-gcs.
// eslint-disable-next-line no-process-env
const GATE = process.env["LAFKEN_E2E_REQUIRES_FAKE_GCS"] === "true";

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

const NIL_UUID = "00000000-0000-0000-0000-000000000000";
// A tiny valid JPEG magic bytes payload
const TINY_JPEG = new Uint8Array([0xff, 0xd8, 0xff]);

describe.skipIf(!GATE)("[E2E] POST /v1/assets/:publicId/confirm (fake-gcs gate)", () => {
  let app: INestApplication;
  let db: DatabaseClient;
  let storageBindingId: string;

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

    const [bindingRow] = await db.connection
      .insertInto("storage_bindings")
      .values({
        name: "test-binding",
        adapter_type: "gcs",
        config: { bucket: "lafken-dev", projectId: "fake-project-1" },
      })
      .returningAll()
      .execute();

    storageBindingId = (bindingRow as { id: string }).id;
  });

  async function insertNamespace(slug: string): Promise<string> {
    return db.connection.transaction().execute(async (tx) => {
      const [nsRow] = await tx
        .insertInto("namespaces")
        .values({
          slug,
          display_name: "Test Namespace",
          current_policy_id: NIL_UUID,
          storage_binding_id: storageBindingId,
        })
        .returningAll()
        .execute();

      const namespaceId = (nsRow as { id: string }).id;

      const [policyRow] = await tx
        .insertInto("namespace_policies")
        .values({
          namespace_id: namespaceId,
          version: 1,
          ...VALID_DB_POLICY_VALUES,
        })
        .returningAll()
        .execute();

      const policyId = (policyRow as { id: string }).id;

      await tx
        .updateTable("namespaces")
        .set({ current_policy_id: policyId })
        .where("id", "=", namespaceId)
        .execute();

      return namespaceId;
    });
  }

  async function createUploadIntent(
    namespaceSlug: string,
  ): Promise<{ publicId: string; uploadUrl: string; uploadHeaders: Record<string, string> }> {
    const response = await request(app.getHttpServer())
      .post("/v1/assets/upload-intents")
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "carlos.cima" })}`)
      .send({
        namespaceSlug,
        declaredMimeType: "image/jpeg",
        declaredSizeBytes: TINY_JPEG.byteLength,
      });

    expect(response.status).toBe(201);
    return {
      publicId: response.body.publicId,
      uploadUrl: response.body.uploadUrl,
      uploadHeaders: response.body.uploadHeaders,
    };
  }

  it("happy path: upload-intent → PUT signed URL → confirm returns 200 with state=uploaded", async () => {
    await insertNamespace("photos-ns");

    const { publicId, uploadUrl, uploadHeaders } = await createUploadIntent("photos-ns");

    // PUT the file to the signed URL
    const putResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: { ...uploadHeaders, "Content-Type": "image/jpeg" },
      body: TINY_JPEG,
    });
    expect(putResponse.ok).toBe(true);

    // Confirm the upload
    const confirmResponse = await request(app.getHttpServer())
      .post(`/v1/assets/${publicId}/confirm`)
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "carlos.cima" })}`);

    expect(confirmResponse.status).toBe(200);
    expect(confirmResponse.body).toMatchObject({
      publicId,
      state: "uploaded",
      namespaceSlug: "photos-ns",
    });

    // Verify asset_state_transitions row was inserted
    const assetRow = await db.connection
      .selectFrom("assets")
      .where("public_id", "=", publicId)
      .selectAll()
      .executeTakeFirst();

    expect(assetRow).toBeDefined();

    const transitions = await db.connection
      .selectFrom("asset_state_transitions")
      .where("asset_id", "=", assetRow!.id)
      .selectAll()
      .execute();

    expect(transitions.length).toBeGreaterThanOrEqual(1);

    // Verify processing_jobs row was inserted
    const jobs = await db.connection
      .selectFrom("processing_jobs")
      .where("asset_id", "=", assetRow!.id)
      .selectAll()
      .execute();

    expect(jobs).toHaveLength(1);
  });

  it("persists width and height when provided in confirm body", async () => {
    await insertNamespace("photos-ns");

    const { publicId, uploadUrl, uploadHeaders } = await createUploadIntent("photos-ns");

    const putResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: { ...uploadHeaders, "Content-Type": "image/jpeg" },
      body: TINY_JPEG,
    });
    expect(putResponse.ok).toBe(true);

    const confirmResponse = await request(app.getHttpServer())
      .post(`/v1/assets/${publicId}/confirm`)
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "carlos.cima" })}`)
      .send({ width: 256, height: 256 });

    expect(confirmResponse.status).toBe(200);
    expect(confirmResponse.body.width).toBe(256);
    expect(confirmResponse.body.height).toBe(256);

    const assetRow = await db.connection
      .selectFrom("assets")
      .where("public_id", "=", publicId)
      .selectAll()
      .executeTakeFirst();

    expect(assetRow).toBeDefined();
    expect((assetRow as { width: number | null }).width).toBe(256);
    expect((assetRow as { height: number | null }).height).toBe(256);
  });

  it("returns RFC 9457 404 when public ID does not match any upload intent", async () => {
    const response = await request(app.getHttpServer())
      .post("/v1/assets/ffffffff-ffff-ffff-ffff-ffffffffffff/confirm")
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "carlos.cima" })}`);

    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toMatch(/application\/problem\+json/);
    expect(response.body.type).toMatch(/upload-intent-not-found-error/);
    expect(response.body.status).toBe(404);
    expect(typeof response.body.detail).toBe("string");
    expect(response.body.detail.length).toBeGreaterThan(0);
  });

  it("returns RFC 9457 422 when object was never PUT to the signed URL", async () => {
    await insertNamespace("photos-ns");

    // Create the intent but skip the PUT step
    const { publicId } = await createUploadIntent("photos-ns");

    const confirmResponse = await request(app.getHttpServer())
      .post(`/v1/assets/${publicId}/confirm`)
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "carlos.cima" })}`);

    expect(confirmResponse.status).toBe(422);
    expect(confirmResponse.headers["content-type"]).toMatch(/application\/problem\+json/);
    expect(confirmResponse.body.type).toMatch(/uploaded-object-missing-error/);
    expect(confirmResponse.body.status).toBe(422);
  });

  it("is idempotent: calling confirm twice returns 200 both times with same publicId and only one asset row", async () => {
    await insertNamespace("photos-ns");

    const { publicId, uploadUrl, uploadHeaders } = await createUploadIntent("photos-ns");

    const putResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: { ...uploadHeaders, "Content-Type": "image/jpeg" },
      body: TINY_JPEG,
    });
    expect(putResponse.ok).toBe(true);

    // First confirm
    const first = await request(app.getHttpServer())
      .post(`/v1/assets/${publicId}/confirm`)
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "carlos.cima" })}`);

    expect(first.status).toBe(200);
    expect(first.body.publicId).toBe(publicId);

    // Second confirm
    const second = await request(app.getHttpServer())
      .post(`/v1/assets/${publicId}/confirm`)
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "carlos.cima" })}`);

    expect(second.status).toBe(200);
    expect(second.body.publicId).toBe(publicId);

    // Only one asset row in DB
    const rows = await db.connection
      .selectFrom("assets")
      .where("public_id", "=", publicId)
      .selectAll()
      .execute();

    expect(rows).toHaveLength(1);
  });

  it("returns 403 when caller lacks PLATFORM_OPERATOR role", async () => {
    const response = await request(app.getHttpServer())
      .post("/v1/assets/some-public-id/confirm")
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "content-reviewer" })}`);

    expect(response.status).toBe(403);
  });
});
