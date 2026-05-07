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
      await tx.deleteFrom("legal_hold_assets").execute();
      await tx.deleteFrom("legal_holds").execute();
      await tx.deleteFrom("assets").execute();
      await tx.deleteFrom("namespace_presets").execute();
      await tx.deleteFrom("upload_intents").execute();
      await tx.deleteFrom("namespace_policies").execute();
      await tx.deleteFrom("namespaces").execute();
      await tx.deleteFrom("storage_bindings").execute();
    });
  });

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

  it("filters by legalHoldId — returns only assets covered by the given hold", async () => {
    // Arrange: storage binding
    const [bindingRow] = await db.connection
      .insertInto("storage_bindings")
      .values({
        name: "legal-hold-filter-binding",
        adapter_type: "gcs",
        config: { bucket: "lafken-dev", projectId: "fake-project-1" },
      })
      .returningAll()
      .execute();

    const storageBindingId = (bindingRow as { id: string }).id;

    // Arrange: namespace + policy (must be done in a transaction to satisfy the FK constraint)
    const { namespaceId, policyId } = await db.connection.transaction().execute(async (tx) => {
      const [nsRow] = await tx
        .insertInto("namespaces")
        .values({
          slug: "ns-legal-hold-filter",
          display_name: "Legal Hold Filter NS",
          current_policy_id: NIL_UUID,
          storage_binding_id: storageBindingId,
        })
        .returningAll()
        .execute();

      const nsId = (nsRow as { id: string }).id;

      const [policyRow] = await tx
        .insertInto("namespace_policies")
        .values({
          namespace_id: nsId,
          version: 1,
          ...VALID_DB_POLICY_VALUES,
        })
        .returningAll()
        .execute();

      const polId = (policyRow as { id: string }).id;

      await tx
        .updateTable("namespaces")
        .set({ current_policy_id: polId })
        .where("id", "=", nsId)
        .execute();

      return { namespaceId: nsId, policyId: polId };
    });

    // Arrange: two assets — only the first will be covered by the legal hold
    const [firstAssetRow] = await db.connection
      .insertInto("assets")
      .values({
        namespace_id: namespaceId,
        policy_version_id: policyId,
        storage_binding_id: storageBindingId,
        storage_key: "ns-legal-hold-filter/asset-1.jpg",
        state: "uploaded",
        mime_type: "image/jpeg",
        size_bytes: BigInt(1024),
        effective_max_size_bytes: BigInt(52_428_800),
        effective_url_ttl: 3600,
      })
      .returningAll()
      .execute();

    await db.connection
      .insertInto("assets")
      .values({
        namespace_id: namespaceId,
        policy_version_id: policyId,
        storage_binding_id: storageBindingId,
        storage_key: "ns-legal-hold-filter/asset-2.jpg",
        state: "uploaded",
        mime_type: "image/jpeg",
        size_bytes: BigInt(2048),
        effective_max_size_bytes: BigInt(52_428_800),
        effective_url_ttl: 3600,
      })
      .returningAll()
      .execute();

    const firstAsset = firstAssetRow as { id: string; public_id: string };

    // Arrange: legal hold covering only the first asset
    const [hold] = await db.connection
      .insertInto("legal_holds")
      .values({
        case_reference: "CHL-AVN-2026-100",
        description: "Filter test hold",
        scope_summary: "1 asset(s) across namespace ns-legal-hold-filter",
        placed_by: "test@test.com",
        active: true,
      })
      .returningAll()
      .execute();

    const holdId = (hold as { id: string }).id;

    await db.connection
      .insertInto("legal_hold_assets")
      .values({ legal_hold_id: holdId, asset_id: firstAsset.id })
      .execute();

    // Act
    const response = await request(app.getHttpServer())
      .get(`/v1/assets?legalHoldId=${holdId}`)
      .set("Authorization", "Bearer test-token");

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].publicId).toBe(firstAsset.public_id);
  });
});
