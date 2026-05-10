import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { mintDevOidcToken } from "../../../../__fixtures__/dev-oidc-token";
import { createAppModuleForE2ETest } from "../../../__fixtures__/app-module-factory";
import { truncateAllAssetTables } from "../../../common/database-cleanup.helper";

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

const NAMESPACE_PRESET_PARAMS = {
  width: 400,
  height: 400,
  fit: "cover",
  format: "webp",
  quality: 85,
};

describe.skipIf(!GATE)("[E2E] GET /v1/assets/:publicId/preview-url", () => {
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
        name: "preview-url-binding",
        adapter_type: "gcs",
        config: { bucket: "lafken-dev", projectId: "fake-project-1" },
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

  it("returns 200 with a signed URL when requesting the system 'lafken:thumbnail' preset", async () => {
    const { namespaceId, policyId } = await insertNamespace("preview-system-ns");
    const { publicId } = await insertAsset({
      namespaceId,
      policyVersionId: policyId,
    });

    const response = await request(app.getHttpServer())
      .get(`/v1/assets/${publicId}/preview-url`)
      .query({ preset: "lafken:thumbnail" })
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "carlos.cima" })}`);

    expect(response.status).toBe(200);
    expect(typeof response.body.url).toBe("string");
    expect(response.body.url.length).toBeGreaterThan(0);
    expect(response.headers["cache-control"]).toContain("max-age=300");
    expect(response.body).toMatchObject({ url: expect.any(String), expiresAt: expect.any(String) });
    expect(new Date(response.body.expiresAt).toString()).not.toBe("Invalid Date");
    expect(new Date(response.body.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("returns 200 with a signed URL when requesting an active namespace preset", async () => {
    const { namespaceId, policyId } = await insertNamespace("preview-ns-preset-ns");
    const { publicId } = await insertAsset({
      namespaceId,
      policyVersionId: policyId,
    });

    await db.connection
      .insertInto("namespace_presets")
      .values({
        namespace_id: namespaceId,
        name: "cover-md",
        version: 1,
        params: NAMESPACE_PRESET_PARAMS,
        active: true,
        created_by: "ops@latam.com",
      })
      .execute();

    const response = await request(app.getHttpServer())
      .get(`/v1/assets/${publicId}/preview-url`)
      .query({ preset: "cover-md" })
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "carlos.cima" })}`);

    expect(response.status).toBe(200);
    expect(typeof response.body.url).toBe("string");
    expect(response.body.url.length).toBeGreaterThan(0);
    expect(response.body).toMatchObject({ url: expect.any(String), expiresAt: expect.any(String) });
    expect(new Date(response.body.expiresAt).toString()).not.toBe("Invalid Date");
    expect(new Date(response.body.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("returns RFC 9457 404 when the public ID does not match any asset", async () => {
    const response = await request(app.getHttpServer())
      .get("/v1/assets/01900000-0000-7000-8000-000000000000/preview-url")
      .query({ preset: "lafken:thumbnail" })
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "carlos.cima" })}`);

    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toMatch(/application\/problem\+json/);
    expect(response.body.status).toBe(404);
    expect(typeof response.body.detail).toBe("string");
    expect(response.body.detail.length).toBeGreaterThan(0);
  });

  it("returns RFC 9457 404 when the requested preset does not match any active preset", async () => {
    const { namespaceId, policyId } = await insertNamespace("preview-unknown-preset-ns");
    const { publicId } = await insertAsset({
      namespaceId,
      policyVersionId: policyId,
    });

    const response = await request(app.getHttpServer())
      .get(`/v1/assets/${publicId}/preview-url`)
      .query({ preset: "no-such-preset" })
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "carlos.cima" })}`);

    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toMatch(/application\/problem\+json/);
    expect(response.body.status).toBe(404);
    expect(response.body.detail).toContain("no-such-preset");
  });

  it("returns 422 when the preset query parameter is missing", async () => {
    const { namespaceId, policyId } = await insertNamespace("preview-missing-preset-ns");
    const { publicId } = await insertAsset({
      namespaceId,
      policyVersionId: policyId,
    });

    const response = await request(app.getHttpServer())
      .get(`/v1/assets/${publicId}/preview-url`)
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "carlos.cima" })}`);

    expect(response.status).toBe(422);
    expect(response.headers["content-type"]).toMatch(/application\/problem\+json/);
    expect(response.body.status).toBe(422);
  });

  // Note: a 401 unauthenticated case is not asserted here because the e2e suite
  // requires a real dev-oidc token; missing/invalid tokens return 401. The
  // unauthenticated path is exercised by the OIDC strategy's own contract tests.
});
