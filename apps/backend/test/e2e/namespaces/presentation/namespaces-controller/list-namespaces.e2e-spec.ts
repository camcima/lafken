import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { createAppModuleForE2ETest } from "../../../__fixtures__/app-module-factory";

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
    // Clean the namespace-related tables before each test so data from other
    // test runs does not interfere. Uses a transaction to handle the
    // DEFERRABLE FK: namespaces.current_policy_id → namespace_policies.
    await db.connection.transaction().execute(async (tx) => {
      await tx.deleteFrom("namespace_presets").execute();
      await tx.deleteFrom("assets").execute();
      // Delete policies first (deferred FK namespaces.current_policy_id checked at commit).
      // Namespaces must be deleted after policies to satisfy the RESTRICT FK
      // namespace_policies.namespace_id → namespaces.id.
      await tx.deleteFrom("namespace_policies").execute();
      await tx.deleteFrom("namespaces").execute();
    });
  });

  it("returns an empty paginated response when there are no namespaces", async () => {
    const response = await request(app.getHttpServer())
      .get("/v1/namespaces")
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

  it("returns RFC 7807 404 for an unknown slug", async () => {
    const response = await request(app.getHttpServer())
      .get("/v1/namespaces/missing-slug")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    // The global filter propagates the domain error's title when the cause is a DomainError.
    expect(response.body).toMatchObject({
      type: "about:blank",
      title: "NamespaceNotFoundError",
      status: 404,
      detail: expect.stringContaining("missing-slug"),
    });
  });
});
