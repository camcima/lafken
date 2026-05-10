import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { mintDevOidcToken } from "../../../../__fixtures__/dev-oidc-token";
import { createAppModuleForE2ETest } from "../../../__fixtures__/app-module-factory";
import { truncateAllAssetTables } from "../../../common/database-cleanup.helper";

// Tests that call the GCS signing path require fake-gcs to be running.
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

describe("[E2E] POST /v1/assets/upload-intents", () => {
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

  async function insertNamespace(slug: string, archivedAt: Date | null = null): Promise<string> {
    return db.connection.transaction().execute(async (tx) => {
      const [nsRow] = await tx
        .insertInto("namespaces")
        .values({
          slug,
          display_name: "Test Namespace",
          current_policy_id: NIL_UUID,
          storage_binding_id: storageBindingId,
          archived_at: archivedAt ?? undefined,
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

  // These tests require fake-gcs because they reach the GCS signing step
  it.skipIf(!GATE)(
    "returns 201 with uploadUrl, publicId, uploadHeaders, and expiresAt on valid input",
    async () => {
      await insertNamespace("photos-ns");

      const response = await request(app.getHttpServer())
        .post("/v1/assets/upload-intents")
        .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "carlos.cima" })}`)
        .send({
          namespaceSlug: "photos-ns",
          declaredMimeType: "image/jpeg",
          declaredSizeBytes: 102400,
        });

      expect(response.status).toBe(201);
      expect(typeof response.body.publicId).toBe("string");
      expect(response.body.publicId.length).toBeGreaterThan(0);
      expect(typeof response.body.uploadUrl).toBe("string");
      expect(response.body.uploadUrl.length).toBeGreaterThan(0);
      expect(typeof response.body.uploadHeaders).toBe("object");
      expect(typeof response.body.expiresAt).toBe("string");
      // Should be a valid ISO timestamp in the future
      expect(new Date(response.body.expiresAt).getTime()).toBeGreaterThan(Date.now());
    },
  );

  it.skipIf(!GATE)("inserts a row in upload_intents table", async () => {
    await insertNamespace("photos-ns");

    const response = await request(app.getHttpServer())
      .post("/v1/assets/upload-intents")
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "carlos.cima" })}`)
      .send({
        namespaceSlug: "photos-ns",
        declaredMimeType: "image/jpeg",
        declaredSizeBytes: 102400,
      });

    expect(response.status).toBe(201);
    const { publicId } = response.body;

    const rows = await db.connection
      .selectFrom("upload_intents")
      .where("public_id", "=", publicId)
      .selectAll()
      .execute();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      public_id: publicId,
      declared_mime_type: "image/jpeg",
    });
  });

  it("returns RFC 9457 404 with type=namespace-not-found-error when namespace does not exist", async () => {
    const response = await request(app.getHttpServer())
      .post("/v1/assets/upload-intents")
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "carlos.cima" })}`)
      .send({
        namespaceSlug: "ghost-ns",
        declaredMimeType: "image/jpeg",
        declaredSizeBytes: 102400,
      });

    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toMatch(/application\/problem\+json/);
    expect(response.body.type).toMatch(/namespace-not-found-error/);
    expect(response.body.status).toBe(404);
    expect(typeof response.body.detail).toBe("string");
    expect(response.body.detail.length).toBeGreaterThan(0);
  });

  it("returns RFC 9457 422 with type=namespace-archived-error when namespace is archived", async () => {
    await insertNamespace("archived-ns", new Date("2024-01-01T00:00:00.000Z"));

    const response = await request(app.getHttpServer())
      .post("/v1/assets/upload-intents")
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "carlos.cima" })}`)
      .send({
        namespaceSlug: "archived-ns",
        declaredMimeType: "image/jpeg",
        declaredSizeBytes: 102400,
      });

    expect(response.status).toBe(422);
    expect(response.headers["content-type"]).toMatch(/application\/problem\+json/);
    expect(response.body.type).toMatch(/namespace-archived-error/);
    expect(response.body.status).toBe(422);
  });

  it("returns RFC 9457 422 with type=mime-type-not-allowed-error for disallowed MIME type", async () => {
    await insertNamespace("photos-ns");

    const response = await request(app.getHttpServer())
      .post("/v1/assets/upload-intents")
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "carlos.cima" })}`)
      .send({
        namespaceSlug: "photos-ns",
        declaredMimeType: "application/pdf",
        declaredSizeBytes: 102400,
      });

    expect(response.status).toBe(422);
    expect(response.headers["content-type"]).toMatch(/application\/problem\+json/);
    expect(response.body.type).toMatch(/mime-type-not-allowed-error/);
    expect(response.body.status).toBe(422);
  });

  it("returns RFC 9457 422 with type=file-size-exceeds-policy-error when declared size exceeds policy max", async () => {
    await insertNamespace("photos-ns");

    const response = await request(app.getHttpServer())
      .post("/v1/assets/upload-intents")
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "carlos.cima" })}`)
      .send({
        namespaceSlug: "photos-ns",
        declaredMimeType: "image/jpeg",
        // 100 MB — well above the 50 MB policy limit
        declaredSizeBytes: 104_857_600,
      });

    expect(response.status).toBe(422);
    expect(response.headers["content-type"]).toMatch(/application\/problem\+json/);
    expect(response.body.type).toMatch(/file-size-exceeds-policy-error/);
    expect(response.body.status).toBe(422);
  });

  it("returns 400 when request body is missing required fields", async () => {
    const response = await request(app.getHttpServer())
      .post("/v1/assets/upload-intents")
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "carlos.cima" })}`)
      .send({});

    expect(response.status).toBe(400);
  });

  it("returns 403 when caller lacks PLATFORM_OPERATOR role", async () => {
    await insertNamespace("photos-ns");

    const response = await request(app.getHttpServer())
      .post("/v1/assets/upload-intents")
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "content-reviewer" })}`)
      .send({
        namespaceSlug: "photos-ns",
        declaredMimeType: "image/jpeg",
        declaredSizeBytes: 102400,
      });

    expect(response.status).toBe(403);
  });
});
