import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { createAppModuleForE2ETest } from "../../../__fixtures__/app-module-factory";

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

describe("[E2E] GET /v1/assets", () => {
  let app: INestApplication;
  let db: DatabaseClient;

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
    await db.connection.transaction().execute(async (tx) => {
      await tx.deleteFrom("asset_analyses").execute();
      await tx.deleteFrom("asset_state_transitions").execute();
      await tx.deleteFrom("processing_jobs").execute();
      await tx.deleteFrom("assets").execute();
      await tx.deleteFrom("namespace_presets").execute();
      await tx.deleteFrom("namespace_policies").execute();
      await tx.deleteFrom("namespaces").execute();
      await tx.deleteFrom("storage_bindings").execute();
    });
  });

  async function seedNamespaceWithAsset(): Promise<{ publicId: string }> {
    return db.connection.transaction().execute(async (tx) => {
      const [bindingRow] = await tx
        .insertInto("storage_bindings")
        .values({
          name: "test-binding",
          adapter_type: "gcs",
          config: { bucket: "lafken-dev", projectId: "fake-project-1" },
        })
        .returningAll()
        .execute();
      const storageBindingId = (bindingRow as { id: string }).id;

      const [nsRow] = await tx
        .insertInto("namespaces")
        .values({
          slug: "photos-ns",
          display_name: "Photos",
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

      const [assetRow] = await tx
        .insertInto("assets")
        .values({
          namespace_id: namespaceId,
          policy_version_id: policyId,
          storage_binding_id: storageBindingId,
          storage_key: "photos-ns/assets/source",
          state: "uploaded",
          declared_mime_type: "image/jpeg",
          effective_max_size_bytes: BigInt(52_428_800),
          effective_url_ttl: 3600,
        })
        .returningAll()
        .execute();

      return { publicId: (assetRow as { public_id: string }).public_id };
    });
  }

  it("returns an empty paginated response when there are no assets", async () => {
    const response = await request(app.getHttpServer())
      .get("/v1/assets")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      lastPage: 1,
    });
  });

  it("returns RFC 9457 404 for an unknown public ID", async () => {
    const response = await request(app.getHttpServer())
      .get("/v1/assets/missing-public-id")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.body).toMatchObject({
      type: "https://lafken.dev/problems/asset-not-found-error",
      title: "AssetNotFoundError",
      status: 404,
      detail: expect.stringContaining("missing-public-id"),
    });
  });

  it("includes a previewUrls map on every asset row", async () => {
    const { publicId } = await seedNamespaceWithAsset();

    const response = await request(app.getHttpServer())
      .get("/v1/assets")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({ publicId });
    expect(response.body.data[0].previewUrls).toEqual({});
  });

  it("includes a previewUrls map on the get-by-public-id response", async () => {
    const { publicId } = await seedNamespaceWithAsset();

    const response = await request(app.getHttpServer())
      .get(`/v1/assets/${publicId}`)
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(200);
    expect(response.body.previewUrls).toEqual({});
  });
});
