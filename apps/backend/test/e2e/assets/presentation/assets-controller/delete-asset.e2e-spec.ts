import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { mintDevOidcToken } from "../../../../__fixtures__/dev-oidc-token";
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

interface ISeededAsset {
  publicId: string;
  assetId: string;
}

describe("[E2E] DELETE /v1/assets/:id", () => {
  let app: INestApplication;
  let db: DatabaseClient;
  let storageBindingId: string;
  let namespaceId: string;
  let policyId: string;

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
      await tx.deleteFrom("upload_intents").execute();
      await tx.deleteFrom("namespace_presets").execute();
      await tx.deleteFrom("namespace_policies").execute();
      await tx.deleteFrom("namespaces").execute();
      await tx.deleteFrom("storage_bindings").execute();
    });

    const bindingRow = await db.connection
      .insertInto("storage_bindings")
      .values({
        name: "test-binding",
        adapter_type: "gcs",
        config: { bucket: "lafken-dev", projectId: "fake-project-1" },
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    storageBindingId = bindingRow.id;

    await db.connection.transaction().execute(async (tx) => {
      const ns = await tx
        .insertInto("namespaces")
        .values({
          slug: "delete-test-ns",
          display_name: "Delete Test",
          current_policy_id: NIL_UUID,
          storage_binding_id: storageBindingId,
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      namespaceId = ns.id;

      const policy = await tx
        .insertInto("namespace_policies")
        .values({ namespace_id: namespaceId, version: 1, ...VALID_DB_POLICY_VALUES })
        .returning("id")
        .executeTakeFirstOrThrow();
      policyId = policy.id;

      await tx
        .updateTable("namespaces")
        .set({ current_policy_id: policyId })
        .where("id", "=", namespaceId)
        .execute();
    });
  });

  async function seedAsset(input?: {
    state?: "uploaded" | "ready" | "deleted";
    legalHold?: boolean;
  }): Promise<ISeededAsset> {
    const state = input?.state ?? "ready";
    const asset = await db.connection
      .insertInto("assets")
      .values({
        namespace_id: namespaceId,
        policy_version_id: policyId,
        state,
        storage_binding_id: storageBindingId,
        storage_key: `delete/asset-${state}.jpg`,
        declared_mime_type: "image/jpeg",
        size_bytes: 42n,
        effective_max_size_bytes: 52_428_800n,
        effective_url_ttl: 3600,
        legal_hold: input?.legalHold ?? false,
        confirmed_at: new Date("2026-05-06T11:59:00.000Z"),
      })
      .returning(["id", "public_id"])
      .executeTakeFirstOrThrow();

    return { assetId: asset.id, publicId: asset.public_id };
  }

  it("returns 204 and transitions an uploaded asset to deleted with audit trail", async () => {
    const { assetId } = await seedAsset({ state: "uploaded" });

    const response = await request(app.getHttpServer())
      .delete(`/v1/assets/${assetId}`)
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "asset-deleter" })}`);

    expect(response.status).toBe(204);

    const asset = await db.connection
      .selectFrom("assets")
      .select(["state", "state_reason"])
      .where("id", "=", assetId)
      .executeTakeFirstOrThrow();
    expect(asset.state).toBe("deleted");
    expect(asset.state_reason).toBe("asset_deleted");

    const transitions = await db.connection
      .selectFrom("asset_state_transitions")
      .select(["from_state", "to_state", "reason", "metadata", "occurred_by"])
      .where("asset_id", "=", assetId)
      .execute();
    expect(transitions).toHaveLength(1);
    expect(transitions[0]?.from_state).toBe("uploaded");
    expect(transitions[0]?.to_state).toBe("deleted");
    expect(transitions[0]?.reason).toBe("asset_deleted");
    expect(transitions[0]?.occurred_by).toBe("asset-deleter@test.local");
    expect(transitions[0]?.metadata).toEqual({ requested_by: "asset-deleter@test.local" });
  });

  it("is idempotent — returns 204 without recording a new transition for an already-deleted asset", async () => {
    const { assetId } = await seedAsset({ state: "deleted" });

    const response = await request(app.getHttpServer())
      .delete(`/v1/assets/${assetId}`)
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "asset-deleter" })}`);

    expect(response.status).toBe(204);

    const transitions = await db.connection
      .selectFrom("asset_state_transitions")
      .select(["to_state"])
      .where("asset_id", "=", assetId)
      .execute();
    expect(transitions).toHaveLength(0);
  });

  it("returns RFC 9457 409 when the asset is under legal hold", async () => {
    const { assetId, publicId } = await seedAsset({ state: "ready", legalHold: true });

    const response = await request(app.getHttpServer())
      .delete(`/v1/assets/${assetId}`)
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "asset-deleter" })}`);

    expect(response.status).toBe(409);
    expect(response.headers["content-type"]).toMatch(/application\/problem\+json/);
    expect(response.body.status).toBe(409);
    expect(response.body.detail).toContain(publicId);
    expect(response.body.detail).toContain("legal hold");

    const asset = await db.connection
      .selectFrom("assets")
      .select(["state"])
      .where("id", "=", assetId)
      .executeTakeFirstOrThrow();
    expect(asset.state).toBe("ready");
  });

  it("returns RFC 9457 404 when the publicId does not match any asset", async () => {
    const response = await request(app.getHttpServer())
      .delete("/v1/assets/ffffffff-ffff-ffff-ffff-ffffffffffff")
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "asset-deleter" })}`);

    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toMatch(/application\/problem\+json/);
    expect(response.body.type).toMatch(/asset-not-found-error/);
    expect(response.body.status).toBe(404);
  });

  it("returns 403 when caller lacks ASSET_DELETER role", async () => {
    const { assetId } = await seedAsset({ state: "ready" });

    const response = await request(app.getHttpServer())
      .delete(`/v1/assets/${assetId}`)
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "carlos.cima" })}`);

    expect(response.status).toBe(403);
  });
});
