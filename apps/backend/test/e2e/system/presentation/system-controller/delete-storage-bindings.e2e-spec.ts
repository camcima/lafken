import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";
import { ApplicationRole } from "@/shared/kernel/domain/application-roles";

import { createAppModuleForE2ETest } from "../../../__fixtures__/app-module-factory";

describe("[E2E] DELETE /v1/system/storage-bindings/:name", () => {
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
      await tx.deleteFrom("namespace_presets").execute();
      await tx.deleteFrom("assets").execute();
      await tx.deleteFrom("namespace_policies").execute();
      await tx.deleteFrom("namespaces").execute();
      await tx.deleteFrom("storage_bindings").execute();
    });
  });

  async function insertBinding(name: string, config: Record<string, unknown>): Promise<void> {
    await db.connection
      .insertInto("storage_bindings")
      .values({
        name,
        adapter_type: "gcs",
        config,
      })
      .execute();
  }

  it("returns 204 and removes the row on a valid delete", async () => {
    await insertBinding("delete-me", { bucket: "lafken-dev", projectId: "fake-project-1" });

    const response = await request(app.getHttpServer())
      .delete("/v1/system/storage-bindings/delete-me")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(204);

    const remaining = await db.connection
      .selectFrom("storage_bindings")
      .selectAll()
      .where("name", "=", "delete-me")
      .execute();
    expect(remaining).toHaveLength(0);
  });

  it("returns RFC 9457 404 when name does not exist", async () => {
    const response = await request(app.getHttpServer())
      .delete("/v1/system/storage-bindings/missing-binding")
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.body).toMatchObject({
      type: "https://lafken.dev/problems/storage-binding-not-found-error",
      status: 404,
      detail: expect.stringContaining("missing-binding"),
    });
  });

  it("returns 403 when caller lacks PLATFORM_OPERATOR role", async () => {
    await insertBinding("forbidden-delete", {
      bucket: "lafken-dev",
      projectId: "fake-project-1",
    });

    const response = await request(app.getHttpServer())
      .delete("/v1/system/storage-bindings/forbidden-delete")
      .set("Authorization", "Bearer test-token")
      .set("x-test-roles", ApplicationRole.CONTENT_REVIEWER);

    expect(response.status).toBe(403);
  });
});
