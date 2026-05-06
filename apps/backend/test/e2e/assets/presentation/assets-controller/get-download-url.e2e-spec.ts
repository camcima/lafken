import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { createAppModuleForE2ETest } from "../../../__fixtures__/app-module-factory";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";
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

describe.skipIf(!GATE)("[E2E] GET /v1/assets/:publicId/download-url", () => {
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

    const [bindingRow] = await db.connection
      .insertInto("storage_bindings")
      .values({
        name: "download-url-binding",
        adapter_type: "gcs",
        config: { bucket: "lafken-dev", projectId: "lafken-dev" },
      })
      .returningAll()
      .execute();

    storageBindingId = (bindingRow as { id: string }).id;
  });

  async function insertNamespace(slug: string): Promise<{ namespaceId: string; policyId: string }> {
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

      return { namespaceId, policyId };
    });
  }

  async function insertAsset(input: {
    namespaceId: string;
    policyVersionId: string;
    storageKey?: string;
  }): Promise<{ publicId: string }> {
    const [assetRow] = await db.connection
      .insertInto("assets")
      .values({
        namespace_id: input.namespaceId,
        policy_version_id: input.policyVersionId,
        storage_binding_id: storageBindingId,
        storage_key: input.storageKey ?? "ns/asset-key.jpg",
        state: "uploaded",
        mime_type: "image/jpeg",
        size_bytes: BigInt(1024),
        effective_max_size_bytes: BigInt(52_428_800),
        effective_url_ttl: 3600,
      })
      .returningAll()
      .execute();

    return { publicId: (assetRow as { public_id: string }).public_id };
  }

  it("returns 200 with a signed read URL for an existing asset", async () => {
    const { namespaceId, policyId } = await insertNamespace("download-ns-ok");
    const { publicId } = await insertAsset({
      namespaceId,
      policyVersionId: policyId,
    });

    const response = await request(app.getHttpServer())
      .get(`/v1/assets/${publicId}/download-url`)
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(200);
    expect(typeof response.body.url).toBe("string");
    expect(response.body.url.length).toBeGreaterThan(0);
    expect(response.body.url).toContain("X-Goog-Signature");
  });

  it("returns RFC 9457 404 when the public ID does not match any asset", async () => {
    const response = await request(app.getHttpServer())
      .get("/v1/assets/01900000-0000-7000-8000-000000000000/download-url")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toMatch(/application\/problem\+json/);
    expect(response.body.status).toBe(404);
    expect(typeof response.body.detail).toBe("string");
    expect(response.body.detail.length).toBeGreaterThan(0);
  });
});
