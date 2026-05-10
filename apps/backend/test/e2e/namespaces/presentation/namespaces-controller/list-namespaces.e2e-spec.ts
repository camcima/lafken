import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { mintDevOidcToken } from "../../../../__fixtures__/dev-oidc-token";
import { createAppModuleForE2ETest } from "../../../__fixtures__/app-module-factory";
import { truncateAllAssetTables } from "../../../common/database-cleanup.helper";

describe("[E2E] GET /v1/namespaces", () => {
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

  it("returns an empty paginated response when there are no namespaces", async () => {
    const response = await request(app.getHttpServer())
      .get("/v1/namespaces")
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "carlos.cima" })}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      lastPage: 1,
    });
  });

  it("returns RFC 9457 404 for an unknown slug", async () => {
    const response = await request(app.getHttpServer())
      .get("/v1/namespaces/missing-slug")
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "carlos.cima" })}`);

    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    // The global filter propagates the domain error's identity when the cause is a DomainError.
    expect(response.body).toMatchObject({
      type: "https://lafken.dev/problems/namespace-not-found-error",
      title: "NamespaceNotFoundError",
      status: 404,
      detail: expect.stringContaining("missing-slug"),
    });
  });
});
