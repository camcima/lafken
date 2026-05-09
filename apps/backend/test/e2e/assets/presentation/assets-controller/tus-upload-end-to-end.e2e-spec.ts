/**
 * Gated full-stack tus end-to-end test.
 *
 * This test drives a real tus upload through the local stack:
 *
 *   Browser (supertest) → NestJS backend → tusd → fake-gcs
 *
 * Prerequisites:
 *   docker compose -f apps/backend/docker-compose.yml up -d
 *
 * Run:
 *   LAFKEN_E2E_REQUIRES_TUSD=true LAFKEN_E2E_REQUIRES_FAKE_GCS=true \
 *     pnpm -F backend e2e/test -- \
 *       test/e2e/assets/presentation/assets-controller/tus-upload-end-to-end.e2e-spec.ts
 *
 * The test is skipped when LAFKEN_E2E_REQUIRES_TUSD is not set to "true" so
 * that it does not block the standard CI/CD E2E run (which does not start a
 * tusd container).
 */
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { createAppModuleForE2ETest } from "../../../__fixtures__/app-module-factory";

// eslint-disable-next-line no-process-env
const GATE = process.env["LAFKEN_E2E_REQUIRES_TUSD"] === "true";

// --------------------------------------------------------------------------
// Tiny JPEG (3 bytes — just the SOI and one marker byte; enough for the test)
// --------------------------------------------------------------------------
const TINY_JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff]);

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

// --------------------------------------------------------------------------
// Suite
// --------------------------------------------------------------------------

describe.skipIf(!GATE)("[E2E] tus upload end-to-end (real stack gate)", () => {
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

  it("end-to-end: upload-intent (tus) → tusd PATCH → confirm returns 200 with state=uploaded", async () => {
    await insertNamespace("tus-e2e-ns");

    // Step 1: Create upload intent with protocol: "tus"
    const intentResponse = await request(app.getHttpServer())
      .post("/v1/assets/upload-intents")
      .set("Authorization", "Bearer test-token")
      .send({
        namespaceSlug: "tus-e2e-ns",
        declaredMimeType: "image/jpeg",
        declaredSizeBytes: TINY_JPEG_BYTES.byteLength,
        protocol: "tus",
      });

    expect(intentResponse.status).toBe(201);

    const { publicId, uploadUrl, uploadHeaders } = intentResponse.body as {
      publicId: string;
      uploadUrl: string;
      uploadHeaders: Record<string, string>;
    };

    expect(publicId).toBeDefined();
    expect(uploadUrl).toMatch(/^http:\/\/localhost:1080\/files\//);
    expect(uploadHeaders["Tus-Resumable"]).toBe("1.0.0");

    // Step 2: Create the tus upload at tusd (POST with tus creation extension)
    // tusd's creation extension: POST to base path creates the upload resource.
    const tusBaseUrl = uploadUrl.substring(0, uploadUrl.lastIndexOf("/") + 1);
    const createResponse = await fetch(tusBaseUrl, {
      method: "POST",
      headers: {
        "Tus-Resumable": "1.0.0",
        "Upload-Length": String(TINY_JPEG_BYTES.byteLength),
        ...uploadHeaders,
        "Content-Length": "0",
      },
    });

    expect(createResponse.status).toBe(201);

    const location = createResponse.headers.get("Location");
    expect(location).toBeTruthy();

    // Step 3: PATCH the upload (send the bytes)
    const patchResponse = await fetch(location as string, {
      method: "PATCH",
      headers: {
        "Tus-Resumable": "1.0.0",
        "Content-Type": "application/offset+octet-stream",
        "Upload-Offset": "0",
        "Content-Length": String(TINY_JPEG_BYTES.byteLength),
      },
      body: TINY_JPEG_BYTES,
    });

    expect(patchResponse.status).toBe(204);
    expect(patchResponse.headers.get("Upload-Offset")).toBe(String(TINY_JPEG_BYTES.byteLength));

    // Step 4: Confirm the upload via the backend
    const confirmResponse = await request(app.getHttpServer())
      .post(`/v1/assets/${publicId}/confirm`)
      .set("Authorization", "Bearer test-token");

    expect(confirmResponse.status).toBe(200);
    expect(confirmResponse.body).toMatchObject({
      publicId,
      state: "uploaded",
      namespaceSlug: "tus-e2e-ns",
    });
  });
});
