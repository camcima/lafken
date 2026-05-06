import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";
import { ApplicationRole } from "@/shared/kernel/domain/application-roles";

import { createAppModuleForE2ETest } from "../../../__fixtures__/app-module-factory";

// case 7 (persistent preset-version-conflict → 409) is covered at the integration level.

const VALID_PARAMS = {
  width: 800,
  height: 600,
  fit: "cover",
  format: "webp",
  quality: 80,
  dpr: 2,
};

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

describe("[E2E] POST /v1/namespaces/:slug/presets", () => {
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
      await tx.deleteFrom("namespace_presets").execute();
      await tx.deleteFrom("asset_analyses").execute();
      await tx.deleteFrom("asset_state_transitions").execute();
      await tx.deleteFrom("processing_jobs").execute();
      await tx.deleteFrom("assets").execute();
      await tx.deleteFrom("upload_intents").execute();
      await tx.deleteFrom("namespace_policies").execute();
      await tx.deleteFrom("namespaces").execute();
      await tx.deleteFrom("storage_bindings").execute();
    });

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

  it("returns 201 with the new preset on valid input", async () => {
    await insertNamespace("active-ns");

    const response = await request(app.getHttpServer())
      .post("/v1/namespaces/active-ns/presets")
      .set("Authorization", "Bearer test-token")
      .send({ name: "thumbnail", params: VALID_PARAMS });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      name: "thumbnail",
      version: 1,
      active: true,
      params: VALID_PARAMS,
    });
    expect(typeof response.body.createdAt).toBe("string");
  });

  it("returns RFC 9457 422 with type=preset-name-already-exists-error when duplicate name", async () => {
    await insertNamespace("dup-ns");

    await request(app.getHttpServer())
      .post("/v1/namespaces/dup-ns/presets")
      .set("Authorization", "Bearer test-token")
      .send({ name: "thumbnail", params: VALID_PARAMS });

    const response = await request(app.getHttpServer())
      .post("/v1/namespaces/dup-ns/presets")
      .set("Authorization", "Bearer test-token")
      .send({ name: "thumbnail", params: VALID_PARAMS });

    expect(response.status).toBe(422);
    expect(response.headers["content-type"]).toMatch(/application\/problem\+json/);
    expect(response.body.type).toMatch(/preset-name-already-exists-error/);
    expect(response.body.status).toBe(422);
    expect(typeof response.body.detail).toBe("string");
    expect(response.body.detail.length).toBeGreaterThan(0);
  });

  it("returns RFC 9457 422 with type=namespace-archived-error when namespace is archived", async () => {
    await insertNamespace("archived-ns", new Date("2024-01-01T00:00:00.000Z"));

    const response = await request(app.getHttpServer())
      .post("/v1/namespaces/archived-ns/presets")
      .set("Authorization", "Bearer test-token")
      .send({ name: "thumbnail", params: VALID_PARAMS });

    expect(response.status).toBe(422);
    expect(response.headers["content-type"]).toMatch(/application\/problem\+json/);
    expect(response.body.type).toMatch(/namespace-archived-error/);
    expect(response.body.status).toBe(422);
    expect(typeof response.body.detail).toBe("string");
    expect(response.body.detail.length).toBeGreaterThan(0);
  });

  it("returns RFC 9457 404 with type=namespace-not-found-error when slug missing", async () => {
    const response = await request(app.getHttpServer())
      .post("/v1/namespaces/ghost-ns/presets")
      .set("Authorization", "Bearer test-token")
      .send({ name: "thumbnail", params: VALID_PARAMS });

    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toMatch(/application\/problem\+json/);
    expect(response.body.type).toMatch(/namespace-not-found-error/);
    expect(response.body.status).toBe(404);
    expect(typeof response.body.detail).toBe("string");
    expect(response.body.detail.length).toBeGreaterThan(0);
  });

  it("returns 400 when params.quality is out of range", async () => {
    await insertNamespace("validate-ns");

    const response = await request(app.getHttpServer())
      .post("/v1/namespaces/validate-ns/presets")
      .set("Authorization", "Bearer test-token")
      .send({ name: "thumbnail", params: { ...VALID_PARAMS, quality: 999 } });

    expect(response.status).toBe(400);
  });

  it("rejects a preset name with the reserved 'lafken:' prefix", async () => {
    await insertNamespace("reserved-prefix-ns");

    const response = await request(app.getHttpServer())
      .post("/v1/namespaces/reserved-prefix-ns/presets")
      .set("Authorization", "Bearer test-token")
      .send({
        name: "lafken:thumbnail",
        params: { width: 100, height: 100, fit: "cover", format: "webp", quality: 80 },
      });

    // The DTO's name regex also forbids ':' as a defense-in-depth boundary,
    // so the rejection surfaces as a 400 from class-validator rather than as
    // the runtime ReservedPresetNameError 422 from the use case. Either way,
    // a namespace owner cannot create a preset that shadows a Lafken-internal
    // name.
    expect(response.status).toBe(400);
    expect(response.headers["content-type"]).toContain("application/problem+json");
  });

  it("returns 403 when caller lacks PLATFORM_OPERATOR role", async () => {
    await insertNamespace("some-ns");

    const response = await request(app.getHttpServer())
      .post("/v1/namespaces/some-ns/presets")
      .set("Authorization", "Bearer test-token")
      .set("x-test-roles", ApplicationRole.CONTENT_REVIEWER)
      .send({ name: "thumbnail", params: VALID_PARAMS });

    expect(response.status).toBe(403);
  });
});
