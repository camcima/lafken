import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { mintDevOidcToken } from "../../../../__fixtures__/dev-oidc-token";
import { createAppModuleForE2ETest } from "../../../__fixtures__/app-module-factory";
import { truncateAllAssetTables } from "../../../common/database-cleanup.helper";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";
const NOTE_MIN_LENGTH = 12;

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

describe("[E2E] POST /v1/quarantine/:publicId/reject", () => {
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
        name: "quarantine-reject-binding",
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
    state: string;
  }): Promise<{ publicId: string; assetId: string }> {
    const [assetRow] = await db.connection
      .insertInto("assets")
      .values({
        namespace_id: input.namespaceId,
        policy_version_id: input.policyVersionId,
        storage_binding_id: storageBindingId,
        // Reject never moves bytes: the storage_key is irrelevant to this
        // spec and the original bytes remain under `_quarantined/` either way.
        storage_key: "ns/asset-key.jpg",
        state: input.state,
        state_reason: "virus_detected",
        mime_type: "image/jpeg",
        size_bytes: BigInt(1024),
        effective_max_size_bytes: BigInt(52_428_800),
        effective_url_ttl: 3600,
      })
      .returningAll()
      .execute();

    return {
      publicId: (assetRow as { public_id: string }).public_id,
      assetId: (assetRow as { id: string }).id,
    };
  }

  it("rejects a quarantined asset and records transition + audit rows", async () => {
    const { namespaceId, policyId } = await insertNamespace("quarantine-reject-ns");
    const { publicId, assetId } = await insertAsset({
      namespaceId,
      policyVersionId: policyId,
      state: "quarantined_moderation",
    });

    const response = await request(app.getHttpServer())
      .post(`/v1/quarantine/${publicId}/reject`)
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "content-reviewer" })}`)
      .send({ note: "contains prohibited content per policy 4.2" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      publicId,
      state: "rejected",
      namespaceSlug: "quarantine-reject-ns",
    });

    const assetRow = await db.connection
      .selectFrom("assets")
      .where("id", "=", assetId)
      .selectAll()
      .executeTakeFirst();
    expect(assetRow?.state).toBe("rejected");

    const transitions = await db.connection
      .selectFrom("asset_state_transitions")
      .where("asset_id", "=", assetId)
      .selectAll()
      .execute();
    expect(transitions).toHaveLength(1);
    expect(transitions[0]).toMatchObject({
      from_state: "quarantined_moderation",
      to_state: "rejected",
    });

    const auditRows = await db.connection
      .selectFrom("configuration_audit_log")
      .where("entity_id", "=", publicId)
      .selectAll()
      .execute();
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]).toMatchObject({ entity_type: "asset", action: "reject" });
    expect(typeof auditRows[0]?.occurred_by).toBe("string");
    expect(auditRows[0]?.occurred_by.length).toBeGreaterThan(0);
    expect(auditRows[0]?.reason).toContain("rejected_from_quarantine");
  });

  it("returns RFC 9457 422 and writes no audit row when the asset is not quarantined", async () => {
    const { namespaceId, policyId } = await insertNamespace("quarantine-reject-422-ns");
    const { publicId } = await insertAsset({
      namespaceId,
      policyVersionId: policyId,
      state: "ready",
    });

    const response = await request(app.getHttpServer())
      .post(`/v1/quarantine/${publicId}/reject`)
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "content-reviewer" })}`)
      .send({ note: "should be refused outright" });

    expect(response.status).toBe(422);
    expect(response.headers["content-type"]).toMatch(/application\/problem\+json/);
    expect(response.body.type).toMatch(/asset-not-in-quarantine-error/);

    const auditRows = await db.connection
      .selectFrom("configuration_audit_log")
      .where("entity_id", "=", publicId)
      .selectAll()
      .execute();
    expect(auditRows).toHaveLength(0);
  });

  it("returns RFC 9457 404 when no asset matches the publicId", async () => {
    const response = await request(app.getHttpServer())
      .post("/v1/quarantine/ffffffff-ffff-ffff-ffff-ffffffffffff/reject")
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "content-reviewer" })}`)
      .send({ note: "nobody home to reject anything" });

    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toMatch(/application\/problem\+json/);
    expect(response.body.status).toBe(404);
  });

  it("returns 403 when the caller lacks a reviewer or operator role", async () => {
    const response = await request(app.getHttpServer())
      .post("/v1/quarantine/ffffffff-ffff-ffff-ffff-ffffffffffff/reject")
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "legal-hold-admin" })}`)
      .send({ note: "not my department at all" });

    expect(response.status).toBe(403);
  });

  // Note: an unauthenticated (no-token) 401 case is intentionally not asserted
  // here, matching the established convention in this suite (see
  // endpoint-post-release.e2e-spec.ts / post-place-legal-hold.e2e-spec.ts) —
  // the OIDC guard's 401 behavior is a cross-cutting concern, not specific to
  // this endpoint.

  it("returns RFC 9457 400 when the note is shorter than the 12-character minimum, leaving the asset untouched", async () => {
    const { namespaceId, policyId } = await insertNamespace("quarantine-reject-400-ns");
    const { publicId, assetId } = await insertAsset({
      namespaceId,
      policyVersionId: policyId,
      state: "quarantined_virus",
    });

    const response = await request(app.getHttpServer())
      .post(`/v1/quarantine/${publicId}/reject`)
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "content-reviewer" })}`)
      .send({ note: "too short" });

    expect(response.status).toBe(400);
    expect(response.headers["content-type"]).toMatch(/application\/problem\+json/);
    expect("too short".length).toBeLessThan(NOTE_MIN_LENGTH);

    // The asset must be untouched by a refused request.
    const assetRow = await db.connection
      .selectFrom("assets")
      .where("id", "=", assetId)
      .selectAll()
      .executeTakeFirst();
    expect(assetRow?.state).toBe("quarantined_virus");

    const auditRows = await db.connection
      .selectFrom("configuration_audit_log")
      .where("entity_id", "=", publicId)
      .selectAll()
      .execute();
    expect(auditRows).toHaveLength(0);
  });

  it("returns RFC 9457 400 and writes no audit row when the note is missing", async () => {
    const { namespaceId, policyId } = await insertNamespace("quarantine-reject-400b-ns");
    const { publicId } = await insertAsset({
      namespaceId,
      policyVersionId: policyId,
      state: "quarantined_invalid_format",
    });

    const response = await request(app.getHttpServer())
      .post(`/v1/quarantine/${publicId}/reject`)
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "content-reviewer" })}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.headers["content-type"]).toMatch(/application\/problem\+json/);

    const auditRows = await db.connection
      .selectFrom("configuration_audit_log")
      .where("entity_id", "=", publicId)
      .selectAll()
      .execute();
    expect(auditRows).toHaveLength(0);
  });
});
