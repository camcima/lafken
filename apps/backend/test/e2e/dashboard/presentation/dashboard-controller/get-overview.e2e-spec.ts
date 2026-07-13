import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { mintDevOidcToken } from "../../../../__fixtures__/dev-oidc-token";
import { createAppModuleForE2ETest } from "../../../__fixtures__/app-module-factory";
import { truncateAllAssetTables } from "../../../common/database-cleanup.helper";

describe("[E2E] Dashboard controller", () => {
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

  describe("GET /v1/dashboard/overview", () => {
    it("returns 200 with all-zero counts and overall ok health snapshot", async () => {
      const response = await request(app.getHttpServer())
        .get("/v1/dashboard/overview")
        .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "carlos.cima" })}`);

      expect(response.status).toBe(200);
      expect(response.body.counts).toEqual({
        totalAssets: 0,
        inFlight: 0,
        queueDepth: 0,
        quarantine: 0,
        legalHolds: 0,
        assetsUnderLegalHold: 0,
        failedProcessing: 0,
        namespaces: 0,
      });
      expect(response.body.health).toMatchObject({
        overall: "ok",
        indicators: [{ name: "database", status: "ok" }],
      });
      expect(response.body.health.integrations).toHaveLength(7);
    });
  });
});
