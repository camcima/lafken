import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";
import { ApplicationRole } from "@/shared/kernel/domain/application-roles";

import { createAppModuleForE2ETest } from "../../../__fixtures__/app-module-factory";

const VALID_POLICY_VALUES = {
  retention_days: null,
  retention_mode: "none",
  max_file_size_bytes: BigInt(52_428_800),
  allowed_mime_types: ["image/jpeg", "image/png", "image/webp"],
  exif_handling: "strip",
  virus_scan_required: true,
  content_moderation: null,
  required_metadata_schema: null,
  immutable: false,
  serving_mode: "signed",
  signed_url_ttl_seconds: 3600,
  signed_url_bucket_size: 300,
  retry_config: null,
  created_by: "ops@latam.com",
};

describe("[E2E] PATCH /v1/namespaces/:slug", () => {
  let app: INestApplication;
  let db: DatabaseClient;
  let storageBindingId: string;

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
      await tx.deleteFrom("asset_analyses").execute();
      await tx.deleteFrom("asset_state_transitions").execute();
      await tx.deleteFrom("processing_jobs").execute();
      await tx.deleteFrom("assets").execute();
      await tx.deleteFrom("namespace_policies").execute();
      await tx.deleteFrom("namespaces").execute();
      await tx.deleteFrom("storage_bindings").execute();
    });

    const [bindingRow] = await db.connection
      .insertInto("storage_bindings")
      .values({
        name: "test-binding",
        adapter_type: "gcs",
        config: { bucket: "lafken-dev", projectId: "fake-project-1" },
      })
      .returningAll()
      .execute();

    storageBindingId = (bindingRow as { id: string }).id;
  });

  async function insertNamespace(slug: string, displayName: string): Promise<void> {
    await db.connection.transaction().execute(async (tx) => {
      const [nsRow] = await tx
        .insertInto("namespaces")
        .values({
          slug,
          display_name: displayName,
          current_policy_id: "00000000-0000-0000-0000-000000000000",
          storage_binding_id: storageBindingId,
        })
        .returningAll()
        .execute();

      const namespaceId = (nsRow as { id: string }).id;

      const [policyRow] = await tx
        .insertInto("namespace_policies")
        .values({
          namespace_id: namespaceId,
          version: 1,
          ...VALID_POLICY_VALUES,
        })
        .returningAll()
        .execute();

      const policyId = (policyRow as { id: string }).id;

      await tx
        .updateTable("namespaces")
        .set({ current_policy_id: policyId })
        .where("id", "=", namespaceId)
        .execute();
    });
  }

  it("returns 200 with updated displayName and description", async () => {
    await insertNamespace("update-me", "Old Name");

    const response = await request(app.getHttpServer())
      .patch("/v1/namespaces/update-me")
      .set("Authorization", "Bearer test-token")
      .send({ displayName: "New Name", description: "A fresh description" });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      slug: "update-me",
      displayName: "New Name",
      description: "A fresh description",
    });
  });

  it("returns RFC 9457 404 with type=namespace-not-found-error when slug does not exist", async () => {
    const response = await request(app.getHttpServer())
      .patch("/v1/namespaces/ghost-namespace")
      .set("Authorization", "Bearer test-token")
      .send({ displayName: "Whatever", description: null });

    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.body).toMatchObject({
      type: "https://lafken.dev/problems/namespace-not-found-error",
      status: 404,
      detail: expect.stringContaining("ghost-namespace"),
    });
  });

  it("returns 403 when caller lacks PLATFORM_OPERATOR role", async () => {
    await insertNamespace("forbidden-update", "Forbidden");

    const response = await request(app.getHttpServer())
      .patch("/v1/namespaces/forbidden-update")
      .set("Authorization", "Bearer test-token")
      .set("x-test-roles", ApplicationRole.CONTENT_REVIEWER)
      .send({ displayName: "New Name", description: null });

    expect(response.status).toBe(403);
  });
});
