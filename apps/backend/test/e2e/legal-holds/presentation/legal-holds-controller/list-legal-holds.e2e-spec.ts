import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { mintDevOidcToken } from "../../../../__fixtures__/dev-oidc-token";
import { createAppModuleForE2ETest } from "../../../__fixtures__/app-module-factory";
import { truncateAllAssetTables } from "../../../common/database-cleanup.helper";

describe("[E2E] GET /v1/legal-holds", () => {
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
    await truncateAllAssetTables(db);
  });

  it("returns an empty paginated response when there are no legal holds", async () => {
    const token = await mintDevOidcToken({ profileId: "carlos.cima" });
    const response = await request(app.getHttpServer())
      .get("/v1/legal-holds")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      lastPage: 1,
    });
  });

  it("returns RFC 9457 404 for an unknown id", async () => {
    const unknownId = "00000000-0000-0000-0000-000000000000";
    const token = await mintDevOidcToken({ profileId: "carlos.cima" });
    const response = await request(app.getHttpServer())
      .get(`/v1/legal-holds/${unknownId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.body).toMatchObject({
      type: "https://lafken.dev/problems/legal-hold-not-found-error",
      title: "LegalHoldNotFoundError",
      status: 404,
      detail: expect.stringContaining(unknownId),
    });
  });

  it("returns 403 on list for an authenticated caller without a legal-holds read role", async () => {
    const token = await mintDevOidcToken({ profileId: "asset-deleter" });
    const response = await request(app.getHttpServer())
      .get("/v1/legal-holds")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
  });

  it("returns 403 on get-by-id for an authenticated caller without a legal-holds read role", async () => {
    const token = await mintDevOidcToken({ profileId: "asset-deleter" });
    const response = await request(app.getHttpServer())
      .get("/v1/legal-holds/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
  });

  it("allows a content reviewer to list legal holds", async () => {
    const token = await mintDevOidcToken({ profileId: "content-reviewer" });
    const response = await request(app.getHttpServer())
      .get("/v1/legal-holds")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
  });
});
