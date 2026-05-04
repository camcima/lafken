import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { createAppModuleForE2ETest } from "../../../__fixtures__/app-module-factory";

describe("[E2E] System controller", () => {
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
    // Clean storage_bindings and dependent tables before each test
    await db.connection.transaction().execute(async (tx) => {
      await tx.deleteFrom("namespace_presets").execute();
      await tx.deleteFrom("assets").execute();
      await tx.deleteFrom("namespace_policies").execute();
      await tx.deleteFrom("namespaces").execute();
      await tx.deleteFrom("storage_bindings").execute();
    });
  });

  describe("GET /v1/system/storage-bindings", () => {
    it("returns 200 with an empty array when no storage bindings exist", async () => {
      const response = await request(app.getHttpServer())
        .get("/v1/system/storage-bindings")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe("GET /v1/system/storage-bindings/:name", () => {
    it("returns RFC 9457 404 for an unknown name", async () => {
      const response = await request(app.getHttpServer())
        .get("/v1/system/storage-bindings/missing-name")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(404);
      expect(response.headers["content-type"]).toContain("application/problem+json");
      expect(response.body).toMatchObject({
        type: "https://lafken.dev/problems/storage-binding-not-found-error",
        status: 404,
        detail: expect.stringContaining("missing-name"),
      });
    });
  });

  describe("GET /v1/system/integrations", () => {
    it("returns 200 with the 7 default not_configured integration statuses", async () => {
      const response = await request(app.getHttpServer())
        .get("/v1/system/integrations")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(7);

      const items = response.body as Array<{ port: string; adapter: string; status: string }>;
      const ports = items.map((item) => item.port);
      expect(ports).toContain("storage");
      expect(ports).toContain("authorization");
      expect(ports).toContain("virus_scan");
      expect(ports).toContain("content_moderation");
      expect(ports).toContain("transformer");
      expect(ports).toContain("event_publisher");
      expect(ports).toContain("secrets");

      for (const item of items) {
        expect(item.status).toBe("not_configured");
        expect(item.adapter).toBe("not_configured");
      }
    });
  });

  describe("GET /v1/system/health", () => {
    it("returns 200 with overall ok when the database is up", async () => {
      const response = await request(app.getHttpServer())
        .get("/v1/system/health")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        overall: "ok",
        indicators: [
          {
            name: "database",
            status: "ok",
          },
        ],
      });
      expect(response.body.integrations).toHaveLength(7);
    });
  });
});
