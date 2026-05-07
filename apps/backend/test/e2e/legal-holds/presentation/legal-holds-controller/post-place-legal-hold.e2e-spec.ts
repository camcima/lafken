import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";
import { ApplicationRole } from "@/shared/kernel/domain/application-roles";

import { createAppModuleForE2ETest } from "../../../__fixtures__/app-module-factory";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

describe("[E2E] POST /v1/legal-holds", () => {
  let app: INestApplication;
  let db: DatabaseClient;
  let assetAPublicId: string;
  let assetBPublicId: string;

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
      await tx.deleteFrom("legal_hold_assets").execute();
      await tx.deleteFrom("legal_holds").execute();
      await tx.deleteFrom("asset_state_transitions").execute();
      await tx.deleteFrom("processing_jobs").execute();
      await tx.deleteFrom("assets").execute();
      await tx.deleteFrom("upload_intents").execute();
      await tx.deleteFrom("namespace_presets").execute();
      await tx.deleteFrom("namespace_policies").execute();
      await tx.deleteFrom("namespaces").execute();
      await tx.deleteFrom("storage_bindings").execute();
    });

    await db.connection.transaction().execute(async (tx) => {
      const binding = await tx
        .insertInto("storage_bindings")
        .values({
          name: "t",
          adapter_type: "gcs",
          config: { bucket: "lafken-dev", projectId: "p" },
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      const ns = await tx
        .insertInto("namespaces")
        .values({
          slug: "ns-a",
          display_name: "NS A",
          description: null,
          current_policy_id: NIL_UUID,
          storage_binding_id: binding.id,
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      const policy = await tx
        .insertInto("namespace_policies")
        .values({
          namespace_id: ns.id,
          version: 1,
          retention_days: null,
          retention_mode: "none",
          max_file_size_bytes: BigInt(52_428_800),
          allowed_mime_types: ["image/jpeg"],
          exif_handling: "strip",
          virus_scan_required: true,
          content_moderation: null,
          required_metadata_schema: null,
          immutable: false,
          serving_mode: "public",
          signed_url_ttl_seconds: null,
          signed_url_bucket_size: null,
          retry_config: null,
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      await tx
        .updateTable("namespaces")
        .set({ current_policy_id: policy.id })
        .where("id", "=", ns.id)
        .execute();

      const inserted = await tx
        .insertInto("assets")
        .values([
          {
            namespace_id: ns.id,
            policy_version_id: policy.id,
            state: "ready",
            storage_binding_id: binding.id,
            storage_key: "ns-a/a/source",
            mime_type: "image/jpeg",
            size_bytes: BigInt(1024),
            effective_max_size_bytes: BigInt(52_428_800),
            effective_url_ttl: 3600,
          },
          {
            namespace_id: ns.id,
            policy_version_id: policy.id,
            state: "ready",
            storage_binding_id: binding.id,
            storage_key: "ns-a/b/source",
            mime_type: "image/jpeg",
            size_bytes: BigInt(1024),
            effective_max_size_bytes: BigInt(52_428_800),
            effective_url_ttl: 3600,
          },
        ])
        .returning("public_id")
        .execute();

      assetAPublicId = inserted[0].public_id;
      assetBPublicId = inserted[1].public_id;
    });
  });

  it("returns 201 + LegalHoldResponseDTO on happy path", async () => {
    const response = await request(app.getHttpServer())
      .post("/v1/legal-holds")
      .set("Authorization", "Bearer test-token")
      .set("x-test-roles", ApplicationRole.LEGAL_HOLD_ADMIN)
      .send({
        caseReference: "CHL-AVN-2026-001",
        description: "DGAC investigation — preserve responsive imagery.",
        assetIds: [assetAPublicId, assetBPublicId],
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      caseReference: "CHL-AVN-2026-001",
      active: true,
      affectedAssetCount: 2,
    });
    expect(typeof response.body.id).toBe("string");
  });

  it("returns 400 when assetIds is empty (class-validator @ArrayMinSize)", async () => {
    const response = await request(app.getHttpServer())
      .post("/v1/legal-holds")
      .set("Authorization", "Bearer test-token")
      .set("x-test-roles", ApplicationRole.LEGAL_HOLD_ADMIN)
      .send({
        caseReference: "CHL-AVN-2026-002",
        description: "DGAC investigation — preserve responsive imagery.",
        assetIds: [],
      });

    expect(response.status).toBe(400);
  });

  it("returns 422 + missingPublicIds in params for unknown publicIds", async () => {
    const unknown = "00000000-0000-0000-0000-000000000000";
    const response = await request(app.getHttpServer())
      .post("/v1/legal-holds")
      .set("Authorization", "Bearer test-token")
      .set("x-test-roles", ApplicationRole.LEGAL_HOLD_ADMIN)
      .send({
        caseReference: "CHL-AVN-2026-003",
        description: "DGAC investigation — preserve responsive imagery.",
        assetIds: [assetAPublicId, unknown],
      });

    expect(response.status).toBe(422);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.body).toMatchObject({
      type: "https://lafken.dev/problems/assets-not-found-for-legal-hold-error",
      status: 422,
      params: {
        missingPublicIds: [unknown],
      },
    });
  });

  it("returns 403 when the caller lacks LEGAL_HOLD_ADMIN", async () => {
    const response = await request(app.getHttpServer())
      .post("/v1/legal-holds")
      .set("Authorization", "Bearer test-token")
      .set("x-test-roles", ApplicationRole.CONTENT_REVIEWER)
      .send({
        caseReference: "CHL-AVN-2026-004",
        description: "DGAC investigation — preserve responsive imagery.",
        assetIds: [assetAPublicId],
      });

    expect(response.status).toBe(403);
  });

  // Note: a 401 unauthenticated case is not asserted here because the e2e suite
  // wires the MockOidcBearerAuthnStrategy, which always authenticates the
  // request even when no Authorization header is sent. The unauthenticated
  // path is exercised by the OIDC strategy's own contract tests.
});
