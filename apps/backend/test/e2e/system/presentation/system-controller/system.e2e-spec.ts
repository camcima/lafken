import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";
import { NIL_UUID } from "@/shared/kernel/domain/nil-uuid.constant";

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
      await tx.deleteFrom("asset_analyses").execute();
      await tx.deleteFrom("asset_state_transitions").execute();
      await tx.deleteFrom("processing_jobs").execute();
      await tx.deleteFrom("legal_hold_assets").execute();
      await tx.deleteFrom("legal_holds").execute();
      await tx.deleteFrom("assets").execute();
      await tx.deleteFrom("upload_intents").execute();
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

  describe("DELETE /v1/system/storage-bindings/:name", () => {
    it("returns RFC 9457 409 when a namespace references the binding", async () => {
      await db.connection.transaction().execute(async (tx) => {
        const binding = await tx
          .insertInto("storage_bindings")
          .values({
            name: "bound-storage",
            adapter_type: "gcs",
            config: { bucket: "lafken-dev", projectId: "lafken-dev" },
          })
          .returning("id")
          .executeTakeFirstOrThrow();
        const storageBindingId = (binding as { id: string }).id;

        const namespace = await tx
          .insertInto("namespaces")
          .values({
            slug: "bound-namespace",
            display_name: "Bound namespace",
            description: null,
            current_policy_id: NIL_UUID,
            storage_binding_id: storageBindingId,
          })
          .returning("id")
          .executeTakeFirstOrThrow();
        const namespaceId = (namespace as { id: string }).id;

        const policy = await tx
          .insertInto("namespace_policies")
          .values({
            namespace_id: namespaceId,
            version: 1,
            retention_days: null,
            retention_mode: "none",
            max_file_size_bytes: 52_428_800n,
            allowed_mime_types: ["image/jpeg"],
            exif_handling: "strip",
            virus_scan_required: true,
            content_moderation: null,
            required_metadata_schema: null,
            immutable: false,
            serving_mode: "signed",
            signed_url_ttl_seconds: 3600,
            signed_url_bucket_size: 300,
            retry_config: null,
            created_by: null,
          })
          .returning("id")
          .executeTakeFirstOrThrow();

        await tx
          .updateTable("namespaces")
          .set({ current_policy_id: (policy as { id: string }).id })
          .where("id", "=", namespaceId)
          .execute();
      });

      const response = await request(app.getHttpServer())
        .delete("/v1/system/storage-bindings/bound-storage")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(409);
      expect(response.headers["content-type"]).toContain("application/problem+json");
      expect(response.body).toMatchObject({
        type: "https://lafken.dev/problems/storage-binding-in-use-error",
        status: 409,
        detail: expect.stringContaining("bound-storage"),
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
