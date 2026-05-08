import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { createAppModuleForE2ETest } from "../../../__fixtures__/app-module-factory";

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

interface ITestNamespaceRefs {
  bindingId: string;
  namespaceId: string;
  policyId: string;
}

// TODO: BE controller endpoint not yet wired (GetNamespaceStorageUsageUseCase exists but no handler).
// Restored from stash; un-skip once the controller registers the route.
describe.skip("[E2E] GET /v1/assets/storage-usage", () => {
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
      await tx.deleteFrom("upload_intents").execute();
      await tx.deleteFrom("namespace_policies").execute();
      await tx.deleteFrom("namespaces").execute();
      await tx.deleteFrom("storage_bindings").execute();
    });
  });

  async function seedNamespace(slug: string): Promise<ITestNamespaceRefs> {
    return db.connection.transaction().execute(async (tx) => {
      const [bindingRow] = await tx
        .insertInto("storage_bindings")
        .values({
          name: `${slug}-binding`,
          adapter_type: "gcs",
          config: { bucket: "lafken-dev", projectId: "fake-project-1" },
        })
        .returningAll()
        .execute();
      const bindingId = (bindingRow as { id: string }).id;

      const [nsRow] = await tx
        .insertInto("namespaces")
        .values({
          slug,
          display_name: slug,
          current_policy_id: NIL_UUID,
          storage_binding_id: bindingId,
        })
        .returningAll()
        .execute();
      const namespaceId = (nsRow as { id: string }).id;

      const [policyRow] = await tx
        .insertInto("namespace_policies")
        .values({ namespace_id: namespaceId, version: 1, ...VALID_DB_POLICY_VALUES })
        .returningAll()
        .execute();
      const policyId = (policyRow as { id: string }).id;

      await tx
        .updateTable("namespaces")
        .set({ current_policy_id: policyId })
        .where("id", "=", namespaceId)
        .execute();

      return { bindingId, namespaceId, policyId };
    });
  }

  async function insertAsset(
    refs: ITestNamespaceRefs,
    input: { state: string; sizeBytes: bigint | null; key: string },
  ): Promise<void> {
    await db.connection
      .insertInto("assets")
      .values({
        namespace_id: refs.namespaceId,
        policy_version_id: refs.policyId,
        storage_binding_id: refs.bindingId,
        storage_key: input.key,
        state: input.state,
        mime_type: "image/jpeg",
        size_bytes: input.sizeBytes,
        effective_max_size_bytes: BigInt(52_428_800),
        effective_url_ttl: 3600,
      })
      .execute();
  }

  it("returns 200 with zero totals for a namespace with no assets", async () => {
    await seedNamespace("usage-empty");

    const response = await request(app.getHttpServer())
      .get("/v1/assets/storage-usage")
      .query({ namespaceSlug: "usage-empty" })
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      namespaceSlug: "usage-empty",
      totalBytes: 0,
      assetCount: 0,
    });
  });

  it("returns 200 with summed bytes and asset count for uploaded assets", async () => {
    const refs = await seedNamespace("usage-filled");
    await insertAsset(refs, { state: "uploaded", sizeBytes: 1024n, key: "a.jpg" });
    await insertAsset(refs, { state: "ready", sizeBytes: 2048n, key: "b.jpg" });
    await insertAsset(refs, { state: "expired", sizeBytes: 9000n, key: "c.jpg" });

    const response = await request(app.getHttpServer())
      .get("/v1/assets/storage-usage")
      .query({ namespaceSlug: "usage-filled" })
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      namespaceSlug: "usage-filled",
      totalBytes: 3072,
      assetCount: 2,
    });
  });

  it("returns RFC 9457 404 when the namespace does not exist", async () => {
    const response = await request(app.getHttpServer())
      .get("/v1/assets/storage-usage")
      .query({ namespaceSlug: "no-such-namespace" })
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toMatch(/application\/problem\+json/);
    expect(response.body.status).toBe(404);
    expect(response.body.detail).toContain("no-such-namespace");
  });

  it("returns 422 when the namespaceSlug query parameter is missing", async () => {
    const response = await request(app.getHttpServer())
      .get("/v1/assets/storage-usage")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(422);
    expect(response.headers["content-type"]).toMatch(/application\/problem\+json/);
    expect(response.body.status).toBe(422);
  });
});
