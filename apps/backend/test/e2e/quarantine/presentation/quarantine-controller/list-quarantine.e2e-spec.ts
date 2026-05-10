import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { mintDevOidcToken } from "../../../../__fixtures__/dev-oidc-token";
import { createAppModuleForE2ETest } from "../../../__fixtures__/app-module-factory";
import { truncateAllAssetTables } from "../../../common/database-cleanup.helper";

describe("[E2E] GET /v1/quarantine", () => {
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

  it("returns an empty paginated response when there are no quarantined assets", async () => {
    const response = await request(app.getHttpServer())
      .get("/v1/quarantine")
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
});
