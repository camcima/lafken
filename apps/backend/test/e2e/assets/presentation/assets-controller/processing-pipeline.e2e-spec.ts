import type { INestApplication } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import sharp from "sharp";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ProcessClaimedAssetUseCase } from "@/assets/application/processing/process-claimed-asset.use-case";
import { AssetsProcessingWorkerModule } from "@/assets/assets-processing-worker.module";
import { AppLoggerPort } from "@/shared/application/app-logger.port";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { NoopApplicationWithErrorLoggerMock } from "../../../../__mocks__/noop-app-logger.service";
import { createAppModuleForE2ETest } from "../../../__fixtures__/app-module-factory";

// This suite requires fake-gcs because it uploads bytes through a signed URL
// and the processing use case reads those bytes back through the GCS adapter.
// eslint-disable-next-line no-process-env
const GATE = process.env["LAFKEN_E2E_REQUIRES_FAKE_GCS"] === "true";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";
const AUTH_HEADERS = { Authorization: "Bearer test-token" };
const PNG_WIDTH = 4;
const PNG_HEIGHT = 5;
const VALID_DB_POLICY_VALUES = {
  retention_days: null,
  retention_mode: "none",
  max_file_size_bytes: BigInt(52_428_800),
  allowed_mime_types: ["image/png"],
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

describe.skipIf(!GATE)("[E2E] asset processing pipeline (fake-gcs gate)", () => {
  let app: INestApplication;
  let db: DatabaseClient;
  let workerModule: TestingModule;
  let processClaimedAssetUseCase: ProcessClaimedAssetUseCase;
  let storageBindingId: string;

  beforeAll(async () => {
    const fixture = await createAppModuleForE2ETest();
    app = fixture.appFixture;
    db = fixture.getDatabaseClient();
    await app.init();

    workerModule = await Test.createTestingModule({
      imports: [AssetsProcessingWorkerModule],
    })
      .overrideProvider(AppLoggerPort)
      .useClass(NoopApplicationWithErrorLoggerMock)
      .compile();
    processClaimedAssetUseCase = workerModule.get(ProcessClaimedAssetUseCase);
  });

  afterAll(async () => {
    await workerModule.close();
    await app.close();
  });

  beforeEach(async () => {
    await db.connection.transaction().execute(async (tx) => {
      await tx.deleteFrom("asset_analyses").execute();
      await tx.deleteFrom("upload_intents").execute();
      await tx.deleteFrom("asset_state_transitions").execute();
      await tx.deleteFrom("processing_jobs").execute();
      await tx.deleteFrom("legal_hold_assets").execute();
      await tx.deleteFrom("legal_holds").execute();
      await tx.deleteFrom("assets").execute();
      await tx.deleteFrom("namespace_presets").execute();
      await tx.deleteFrom("namespace_policies").execute();
      await tx.deleteFrom("namespaces").execute();
      await tx.deleteFrom("storage_bindings").execute();
    });

    const [bindingRow] = await db.connection
      .insertInto("storage_bindings")
      .values({
        name: "processing-test-binding",
        adapter_type: "gcs",
        config: { bucket: "lafken-dev", projectId: "fake-project-1" },
      })
      .returningAll()
      .execute();

    storageBindingId = (bindingRow as { id: string }).id;
  });

  it("processes a confirmed image into ready with metadata and evidence", async () => {
    await insertNamespace("aircraft-photos");
    const pngBytes = await sharp({
      create: {
        width: PNG_WIDTH,
        height: PNG_HEIGHT,
        channels: 3,
        background: { r: 10, g: 20, b: 30 },
      },
    })
      .png()
      .toBuffer();

    const uploadIntent = await request(app.getHttpServer())
      .post("/v1/assets/upload-intents")
      .set(AUTH_HEADERS)
      .send({
        namespaceSlug: "aircraft-photos",
        declaredMimeType: "image/png",
        declaredSizeBytes: pngBytes.length,
      })
      .expect(201);

    const putResponse = await fetch(uploadIntent.body.uploadUrl, {
      method: "PUT",
      body: new Uint8Array(pngBytes),
      headers: { ...uploadIntent.body.uploadHeaders, "Content-Type": "image/png" },
    });
    expect(putResponse.ok).toBe(true);

    await request(app.getHttpServer())
      .post(`/v1/assets/${uploadIntent.body.publicId}/confirm`)
      .set(AUTH_HEADERS)
      .send({})
      .expect(200);

    const assetRow = await db.connection
      .selectFrom("assets")
      .select("id")
      .where("public_id", "=", uploadIntent.body.publicId)
      .executeTakeFirstOrThrow();

    const job = await db.connection
      .selectFrom("processing_jobs")
      .selectAll()
      .where("asset_id", "=", assetRow.id)
      .executeTakeFirstOrThrow();

    await db.connection
      .updateTable("processing_jobs")
      .set({
        state: "claimed",
        worker_id: "e2e-worker",
        claimed_at: new Date("2026-05-06T12:00:00.000Z"),
        heartbeat_at: new Date("2026-05-06T12:00:00.000Z"),
      })
      .where("asset_id", "=", job.asset_id)
      .execute();

    await processClaimedAssetUseCase.execute({
      assetId: job.asset_id,
      workerId: "e2e-worker",
      attemptNumber: job.attempt_number,
    });

    const asset = await request(app.getHttpServer())
      .get(`/v1/assets/${assetRow.id}`)
      .set(AUTH_HEADERS)
      .expect(200);

    expect(asset.body.state).toBe("ready");
    expect(asset.body.mimeType).toBe("image/png");
    expect(asset.body.width).toBe(PNG_WIDTH);
    expect(asset.body.height).toBe(PNG_HEIGHT);
    expect(asset.body.contentHashHex).toHaveLength(64);

    const transitions = await request(app.getHttpServer())
      .get(`/v1/assets/${assetRow.id}/state-transitions`)
      .set(AUTH_HEADERS)
      .expect(200);
    const transitionBody = transitions.body as Array<{ toState: string }>;

    expect(transitionBody.map((item: { toState: string }) => item.toState)).toContain("processing");
    expect(transitionBody.map((item: { toState: string }) => item.toState)).toContain("ready");

    const analyses = await request(app.getHttpServer())
      .get(`/v1/assets/${assetRow.id}/analyses`)
      .set(AUTH_HEADERS)
      .expect(200);
    const analysisBody = analyses.body as Array<{ analyzer: string }>;

    expect(analysisBody.map((item: { analyzer: string }) => item.analyzer)).toContain(
      "image_inspection",
    );
    expect(analysisBody.map((item: { analyzer: string }) => item.analyzer)).toContain("virus_scan");
  });

  async function insertNamespace(slug: string): Promise<string> {
    return db.connection.transaction().execute(async (tx) => {
      const [nsRow] = await tx
        .insertInto("namespaces")
        .values({
          slug,
          display_name: "Test Namespace",
          current_policy_id: NIL_UUID,
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
          ...VALID_DB_POLICY_VALUES,
        })
        .returningAll()
        .execute();

      const policyId = (policyRow as { id: string }).id;

      await tx
        .updateTable("namespaces")
        .set({ current_policy_id: policyId })
        .where("id", "=", namespaceId)
        .execute();

      return namespaceId;
    });
  }
});
