import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";
import { ApplicationRole } from "@/shared/kernel/domain/application-roles";

import { createAppModuleForE2ETest } from "../../../__fixtures__/app-module-factory";

describe("[E2E] POST /v1/legal-holds/:id/lift", () => {
  let app: INestApplication;
  let db: DatabaseClient;
  let activeHoldId: string;

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

    const [hold] = await db.connection
      .insertInto("legal_holds")
      .values({
        case_reference: "CHL-AVN-2026-200",
        description: "Active hold for lift e2e",
        scope_summary: "0 asset(s) across namespace none",
        placed_by: "ops@example.com",
        active: true,
      })
      .returningAll()
      .execute();
    activeHoldId = (hold as { id: string }).id;
  });

  it("returns 200 on happy path", async () => {
    const response = await request(app.getHttpServer())
      .post(`/v1/legal-holds/${activeHoldId}/lift`)
      .set("Authorization", "Bearer test-token")
      .set("x-test-roles", ApplicationRole.LEGAL_HOLD_ADMIN)
      .send({ liftReason: "Investigation closed; releasing." });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: activeHoldId,
      active: false,
      liftReason: "Investigation closed; releasing.",
    });
  });

  it("returns 422 when the hold is already lifted", async () => {
    await request(app.getHttpServer())
      .post(`/v1/legal-holds/${activeHoldId}/lift`)
      .set("Authorization", "Bearer test-token")
      .set("x-test-roles", ApplicationRole.LEGAL_HOLD_ADMIN)
      .send({ liftReason: "First lift, ten chars." });

    const second = await request(app.getHttpServer())
      .post(`/v1/legal-holds/${activeHoldId}/lift`)
      .set("Authorization", "Bearer test-token")
      .set("x-test-roles", ApplicationRole.LEGAL_HOLD_ADMIN)
      .send({ liftReason: "Second lift, ten chars." });

    expect(second.status).toBe(422);
    expect(second.headers["content-type"]).toContain("application/problem+json");
    expect(second.body).toMatchObject({
      type: "https://lafken.dev/problems/legal-hold-already-lifted-error",
      status: 422,
    });
  });

  it("returns 404 when the hold id does not exist", async () => {
    const response = await request(app.getHttpServer())
      .post(`/v1/legal-holds/00000000-0000-0000-0000-000000000000/lift`)
      .set("Authorization", "Bearer test-token")
      .set("x-test-roles", ApplicationRole.LEGAL_HOLD_ADMIN)
      .send({ liftReason: "Closing unknown hold for test." });

    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toContain("application/problem+json");
  });

  it("returns 403 without LEGAL_HOLD_ADMIN", async () => {
    const response = await request(app.getHttpServer())
      .post(`/v1/legal-holds/${activeHoldId}/lift`)
      .set("Authorization", "Bearer test-token")
      .set("x-test-roles", ApplicationRole.CONTENT_REVIEWER)
      .send({ liftReason: "Investigation closed; releasing." });

    expect(response.status).toBe(403);
  });
});
