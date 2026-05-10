import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { mintDevOidcToken } from "../../../../__fixtures__/dev-oidc-token";
import { createAppModuleForE2ETest } from "../../../__fixtures__/app-module-factory";
import { truncateAllAssetTables } from "../../../common/database-cleanup.helper";

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

describe("[E2E] POST /v1/namespaces", () => {
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

    const [row] = await db.connection
      .insertInto("storage_bindings")
      .values({
        name: "test-binding",
        adapter_type: "gcs",
        config: { bucket: "lafken-dev", projectId: "fake-project-1" },
      })
      .returningAll()
      .execute();

    storageBindingId = (row as { id: string }).id;
  });

  it("returns 201 + DTO when slug is unique and storage binding exists", async () => {
    const response = await request(app.getHttpServer())
      .post("/v1/namespaces")
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "carlos.cima" })}`)
      .send({
        slug: "aircraft-photos",
        displayName: "Aircraft Photos",
        description: "Photos of aircraft.",
        storageBindingId,
        policy: VALID_POLICY,
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      slug: "aircraft-photos",
      displayName: "Aircraft Photos",
      storageBindingName: "test-binding",
      currentPolicyVersion: 1,
    });
    expect(typeof response.body.createdAt).toBe("string");
    expect(typeof response.body.updatedAt).toBe("string");
  });

  it("returns RFC 9457 409 with type=namespace-already-exists-error on duplicate slug", async () => {
    const body = {
      slug: "duplicate-ns",
      displayName: "Duplicate Namespace",
      description: null,
      storageBindingId,
      policy: VALID_POLICY,
    };

    const first = await request(app.getHttpServer())
      .post("/v1/namespaces")
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "carlos.cima" })}`)
      .send(body);
    expect(first.status).toBe(201);

    const second = await request(app.getHttpServer())
      .post("/v1/namespaces")
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "carlos.cima" })}`)
      .send(body);

    expect(second.status).toBe(409);
    expect(second.headers["content-type"]).toContain("application/problem+json");
    expect(second.body).toMatchObject({
      type: "https://lafken.dev/problems/namespace-already-exists-error",
      status: 409,
    });
    expect(second.body.detail).toContain("duplicate-ns");
  });

  it("returns RFC 9457 422 with type=storage-binding-missing-error when binding id is unknown", async () => {
    const response = await request(app.getHttpServer())
      .post("/v1/namespaces")
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "carlos.cima" })}`)
      .send({
        slug: "missing-binding-ns",
        displayName: "Missing Binding Namespace",
        description: null,
        storageBindingId: "00000000-0000-0000-0000-000000000000",
        policy: VALID_POLICY,
      });

    expect(response.status).toBe(422);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.body).toMatchObject({
      type: "https://lafken.dev/problems/storage-binding-missing-error",
      status: 422,
    });
    expect(response.body.detail).toContain("00000000-0000-0000-0000-000000000000");
  });

  it("returns 400 when slug fails the regex", async () => {
    const response = await request(app.getHttpServer())
      .post("/v1/namespaces")
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "carlos.cima" })}`)
      .send({
        slug: "Bad Slug!",
        displayName: "Bad Slug Namespace",
        description: null,
        storageBindingId,
        policy: VALID_POLICY,
      });

    expect(response.status).toBe(400);
  });

  it("returns 403 when caller lacks PLATFORM_OPERATOR role", async () => {
    const response = await request(app.getHttpServer())
      .post("/v1/namespaces")
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "content-reviewer" })}`)
      .send({
        slug: "forbidden-ns",
        displayName: "Forbidden Namespace",
        description: null,
        storageBindingId,
        policy: VALID_POLICY,
      });

    expect(response.status).toBe(403);
  });
});
