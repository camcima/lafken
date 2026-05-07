import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { createAppModuleForE2ETest } from "../../../__fixtures__/app-module-factory";

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

  describe("GET /v1/dashboard/overview", () => {
    it("returns 200 with all-zero counts and overall ok health snapshot", async () => {
      const response = await request(app.getHttpServer())
        .get("/v1/dashboard/overview")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(200);
      expect(response.body.counts).toEqual({
        totalAssets: 0,
        inFlight: 0,
        queueDepth: 0,
        quarantine: 0,
        legalHolds: 0,
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
