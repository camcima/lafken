import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { mintDevOidcToken } from "../../../../__fixtures__/dev-oidc-token";
import { createAppModuleForE2ETest } from "../../../__fixtures__/app-module-factory";
import { truncateAllAssetTables } from "../../../common/database-cleanup.helper";

describe("[E2E] POST /v1/system/storage-bindings", () => {
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

  it("returns 201 + DTO when name is unique and bucket exists", async () => {
    const response = await request(app.getHttpServer())
      .post("/v1/system/storage-bindings")
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "carlos.cima" })}`)
      .send({
        name: "my-binding",
        adapterType: "gcs",
        config: { bucket: "lafken-dev", projectId: "fake-project-1" },
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      name: "my-binding",
      adapterType: "gcs",
      config: { bucket: "lafken-dev", projectId: "fake-project-1" },
    });
    expect(typeof response.body.createdAt).toBe("string");
  });

  it("returns RFC 9457 422 with type=bucket-not-found-error when bucket missing", async () => {
    const response = await request(app.getHttpServer())
      .post("/v1/system/storage-bindings")
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "carlos.cima" })}`)
      .send({
        name: "missing-bucket",
        adapterType: "gcs",
        config: { bucket: "definitely-missing", projectId: "fake-project-1" },
      });

    expect(response.status).toBe(422);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.body).toMatchObject({
      type: "https://lafken.dev/problems/bucket-not-found-error",
      status: 422,
    });
  });

  it("returns RFC 9457 409 with type=duplicate-storage-binding-name-error on duplicate", async () => {
    const body = {
      name: "duplicate-name",
      adapterType: "gcs" as const,
      config: { bucket: "lafken-dev", projectId: "fake-project-1" },
    };

    const first = await request(app.getHttpServer())
      .post("/v1/system/storage-bindings")
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "carlos.cima" })}`)
      .send(body);
    expect(first.status).toBe(201);

    const second = await request(app.getHttpServer())
      .post("/v1/system/storage-bindings")
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "carlos.cima" })}`)
      .send(body);

    expect(second.status).toBe(409);
    expect(second.headers["content-type"]).toContain("application/problem+json");
    expect(second.body).toMatchObject({
      type: "https://lafken.dev/problems/duplicate-storage-binding-name-error",
      status: 409,
    });
  });

  it("returns 400 when name fails the regex", async () => {
    const response = await request(app.getHttpServer())
      .post("/v1/system/storage-bindings")
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "carlos.cima" })}`)
      .send({
        name: "BadName!",
        adapterType: "gcs",
        config: { bucket: "lafken-dev", projectId: "fake-project-1" },
      });

    expect(response.status).toBe(400);
  });

  it("returns 403 when caller lacks PLATFORM_OPERATOR role", async () => {
    const response = await request(app.getHttpServer())
      .post("/v1/system/storage-bindings")
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "content-reviewer" })}`)
      .send({
        name: "forbidden-name",
        adapterType: "gcs",
        config: { bucket: "lafken-dev", projectId: "fake-project-1" },
      });

    expect(response.status).toBe(403);
  });
});
