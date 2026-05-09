import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";
import { ApplicationRole } from "@/shared/kernel/domain/application-roles";

import { createAppModuleForE2ETest } from "../../../__fixtures__/app-module-factory";

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

describe("[E2E] POST /v1/assets/upload-intents/:publicId/refresh-url", () => {
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
      await tx.deleteFrom("upload_intents").execute();
      await tx.deleteFrom("configuration_audit_log").execute();
      await tx.deleteFrom("asset_state_transitions").execute();
      await tx.deleteFrom("asset_analyses").execute();
      await tx.deleteFrom("processing_jobs").execute();
      await tx.deleteFrom("legal_hold_assets").execute();
      await tx.deleteFrom("legal_holds").execute();
      await tx.deleteFrom("assets").execute();
      await tx.deleteFrom("namespace_presets").execute();
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

  async function createIntent(): Promise<{ publicId: string }> {
    await insertNamespace("photos-ns");
    const response = await request(app.getHttpServer())
      .post("/v1/assets/upload-intents")
      .set("Authorization", "Bearer test-token")
      .send({
        namespaceSlug: "photos-ns",
        declaredMimeType: "image/jpeg",
        declaredSizeBytes: 1024,
      });
    expect(response.status).toBe(201);
    return { publicId: response.body.publicId };
  }

  async function markConsumed(publicId: string): Promise<void> {
    await db.connection
      .updateTable("upload_intents")
      .set({ consumed_at: new Date() })
      .where("public_id", "=", publicId)
      .execute();
  }

  async function markExpired(publicId: string): Promise<void> {
    await db.connection
      .updateTable("upload_intents")
      .set({ expired_at: new Date() })
      .where("public_id", "=", publicId)
      .execute();
  }

  it.skipIf(!GATE)("returns a fresh upload URL and audits url_refreshed", async () => {
    const intent = await createIntent();
    const res = await request(app.getHttpServer())
      .post(`/v1/assets/upload-intents/${intent.publicId}/refresh-url`)
      .set("Authorization", "Bearer test-token")
      .expect(200);
    expect(res.body.uploadUrl).toBeTruthy();
    expect(res.body.uploadHeaders["Content-Type"]).toBe("image/jpeg");
    const audit = await db.connection
      .selectFrom("configuration_audit_log")
      .selectAll()
      .where("entity_type", "=", "upload_intent")
      .where("entity_id", "=", intent.publicId)
      .where("action", "=", "url_refreshed")
      .execute();
    expect(audit).toHaveLength(1);
  });

  it("returns 404 for unknown intent", async () => {
    await request(app.getHttpServer())
      .post(`/v1/assets/upload-intents/00000000-0000-0000-0000-000000000000/refresh-url`)
      .set("Authorization", "Bearer test-token")
      .expect(404);
  });

  it.skipIf(!GATE)("returns 422 for already-consumed intent", async () => {
    const intent = await createIntent();
    await markConsumed(intent.publicId);
    await request(app.getHttpServer())
      .post(`/v1/assets/upload-intents/${intent.publicId}/refresh-url`)
      .set("Authorization", "Bearer test-token")
      .expect(422);
  });

  it.skipIf(!GATE)("returns 422 for swept intent", async () => {
    const intent = await createIntent();
    await markExpired(intent.publicId);
    await request(app.getHttpServer())
      .post(`/v1/assets/upload-intents/${intent.publicId}/refresh-url`)
      .set("Authorization", "Bearer test-token")
      .expect(422);
  });

  it("returns 403 when caller lacks PLATFORM_OPERATOR role", async () => {
    await request(app.getHttpServer())
      .post("/v1/assets/upload-intents/some-public-id/refresh-url")
      .set("Authorization", "Bearer test-token")
      .set("x-test-roles", ApplicationRole.CONTENT_REVIEWER)
      .expect(403);
  });
});
