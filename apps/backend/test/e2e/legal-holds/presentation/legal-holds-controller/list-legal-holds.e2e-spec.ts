import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { createAppModuleForE2ETest } from "../../../__fixtures__/app-module-factory";

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
    await db.connection.transaction().execute(async (tx) => {
      await tx.deleteFrom("legal_hold_assets").execute();
      await tx.deleteFrom("legal_holds").execute();
    });
  });

  it("returns an empty paginated response when there are no legal holds", async () => {
    const response = await request(app.getHttpServer())
      .get("/v1/legal-holds")
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

  it("returns RFC 9457 404 for an unknown id", async () => {
    const response = await request(app.getHttpServer())
      .get("/v1/legal-holds/99999")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.body).toMatchObject({
      type: "https://lafken.dev/problems/legal-hold-not-found-error",
      title: "LegalHoldNotFoundError",
      status: 404,
      detail: expect.stringContaining("99999"),
    });
  });
});
