import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { createAppModuleForE2ETest } from "../../../__fixtures__/app-module-factory";

describe("[E2E] GET /v1/assets", () => {
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
      await tx.deleteFrom("assets").execute();
      await tx.deleteFrom("namespace_presets").execute();
      await tx.deleteFrom("namespace_policies").execute();
      await tx.deleteFrom("namespaces").execute();
      await tx.deleteFrom("storage_bindings").execute();
    });
  });

  it("returns an empty paginated response when there are no assets", async () => {
    const response = await request(app.getHttpServer())
      .get("/v1/assets")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      lastPage: 1,
    });
  });

  it("returns RFC 9457 404 for an unknown public ID", async () => {
    const response = await request(app.getHttpServer())
      .get("/v1/assets/missing-public-id")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.body).toMatchObject({
      type: "https://lafken.dev/problems/asset-not-found-error",
      title: "AssetNotFoundError",
      status: 404,
      detail: expect.stringContaining("missing-public-id"),
    });
  });
});
