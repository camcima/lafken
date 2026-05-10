import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { mintDevOidcToken } from "../../../../__fixtures__/dev-oidc-token";
import { createAppModuleForE2ETest } from "../../../__fixtures__/app-module-factory";
import { truncateAllAssetTables } from "../../../common/database-cleanup.helper";

// case 4 (persistent conflict → 409) is covered at the integration level in
// namespace-write.repository.create-policy-version.spec.ts

const VALID_POLICY = {
  retentionDays: null,
  retentionMode: "none",
  maxFileSizeBytes: 52_428_800,
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  virusScanRequired: true,
  contentModeration: null,
  requiredMetadataSchema: null,
  immutable: false,
  servingMode: "signed",
  signedUrlTtlSeconds: 3600,
  signedUrlBucketSize: 300,
  retryConfig: null,
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

describe("[E2E] POST /v1/namespaces/:slug/policy-versions", () => {
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

  async function insertNamespace(slug: string, archivedAt: Date | null = null): Promise<void> {
    await db.connection.transaction().execute(async (tx) => {
      const [nsRow] = await tx
        .insertInto("namespaces")
        .values({
          slug,
          display_name: "Test Namespace",
          current_policy_id: "00000000-0000-0000-0000-000000000000",
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
    });
  }

  it("returns 200 with the namespace and currentPolicyVersion === 2 when valid input on active namespace", async () => {
    await insertNamespace("active-ns");

    const response = await request(app.getHttpServer())
      .post("/v1/namespaces/active-ns/policy-versions")
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "carlos.cima" })}`)
      .send({ policy: VALID_POLICY });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      slug: "active-ns",
      storageBindingName: "test-binding",
      currentPolicyVersion: 2,
    });
    expect(typeof response.body.createdAt).toBe("string");
    expect(typeof response.body.updatedAt).toBe("string");
  });

  it("returns RFC 9457 404 with type=namespace-not-found-error when slug does not exist", async () => {
    const response = await request(app.getHttpServer())
      .post("/v1/namespaces/ghost-namespace/policy-versions")
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "carlos.cima" })}`)
      .send({ policy: VALID_POLICY });

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
      .post("/v1/namespaces/archived-ns/policy-versions")
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "carlos.cima" })}`)
      .send({ policy: VALID_POLICY });

    expect(response.status).toBe(422);
    expect(response.headers["content-type"]).toMatch(/application\/problem\+json/);
    expect(response.body.type).toMatch(/namespace-archived-error/);
    expect(response.body.status).toBe(422);
    expect(typeof response.body.detail).toBe("string");
    expect(response.body.detail.length).toBeGreaterThan(0);
  });

  it("returns 403 when caller lacks PLATFORM_OPERATOR role", async () => {
    await insertNamespace("some-ns");

    const response = await request(app.getHttpServer())
      .post("/v1/namespaces/some-ns/policy-versions")
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "content-reviewer" })}`)
      .send({ policy: VALID_POLICY });

    expect(response.status).toBe(403);
  });

  it("returns 400 when a policy field fails validation (invalid retentionMode)", async () => {
    await insertNamespace("validate-ns");

    const response = await request(app.getHttpServer())
      .post("/v1/namespaces/validate-ns/policy-versions")
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "carlos.cima" })}`)
      .send({ policy: { ...VALID_POLICY, retentionMode: "bogus" } });

    expect(response.status).toBe(400);
  });
});
