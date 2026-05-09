import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";
import { LAFKEN_METRIC_NAMES } from "@/shared/infrastructure/telemetry/metrics";

import {
  findCounterPoint,
  type IMetricReaderHandle,
  installInMemoryMetricReader,
} from "../../../../__mocks__/in-memory-metric-reader";
import { createAppModuleForE2ETest } from "../../../__fixtures__/app-module-factory";

/**
 * End-to-end check for the v1.0 §5.3 metric set.
 *
 * Drives a full upload-intent → PUT → confirm flow against the running app,
 * then exercises the serving endpoints, and asserts that every metric the
 * non-pipeline path is responsible for fires at least once. Pipeline-side
 * instruments (`lafken.processing.job.claimed`, `processing.step.duration`,
 * `processing.step.outcome`, `processing.terminal_state`) only emit when the
 * worker runs against the seeded job; this e2e bundle does not drive the
 * worker, so those are covered by the unit-level tests added in Task 7.
 */
// eslint-disable-next-line no-process-env
const GATE = process.env["LAFKEN_E2E_REQUIRES_FAKE_GCS"] === "true";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";
const TINY_JPEG = new Uint8Array([0xff, 0xd8, 0xff]);

const VALID_DB_POLICY_VALUES = {
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

describe.skipIf(!GATE)("[E2E] §5.3 Lafken metric emission (fake-gcs gate)", () => {
  let app: INestApplication;
  let db: DatabaseClient;
  let storageBindingId: string;
  let metricsHandle: IMetricReaderHandle;

  beforeAll(async () => {
    metricsHandle = installInMemoryMetricReader();
    const fixture = await createAppModuleForE2ETest();
    app = fixture.appFixture;
    db = fixture.getDatabaseClient();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    metricsHandle.reset();
    await db.connection.transaction().execute(async (tx) => {
      await tx.deleteFrom("upload_intents").execute();
      await tx.deleteFrom("asset_state_transitions").execute();
      await tx.deleteFrom("asset_analyses").execute();
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
        name: "metrics-emission-binding",
        adapter_type: "gcs",
        config: { bucket: "lafken-dev", projectId: "fake-project-1" },
      })
      .returningAll()
      .execute();
    storageBindingId = (bindingRow as { id: string }).id;
  });

  async function insertNamespace(slug: string): Promise<string> {
    return db.connection.transaction().execute(async (tx) => {
      const [nsRow] = await tx
        .insertInto("namespaces")
        .values({
          slug,
          display_name: "Metrics Test Namespace",
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

  it("emits the §5.3 upload + serving + authz metric set on a happy-path round-trip", async () => {
    const namespaceSlug = "metrics-emission-ns";
    await insertNamespace(namespaceSlug);

    // 1. Upload intent
    const intentResponse = await request(app.getHttpServer())
      .post("/v1/assets/upload-intents")
      .set("Authorization", "Bearer test-token")
      .send({
        namespaceSlug,
        declaredMimeType: "image/jpeg",
        declaredSizeBytes: TINY_JPEG.byteLength,
      });
    expect(intentResponse.status).toBe(201);
    const publicId: string = intentResponse.body.publicId;
    const uploadUrl: string = intentResponse.body.uploadUrl;
    const uploadHeaders: Record<string, string> = intentResponse.body.uploadHeaders;

    // 2. PUT bytes to fake-gcs through the signed URL
    const putResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: { ...uploadHeaders, "Content-Type": "image/jpeg" },
      body: TINY_JPEG,
    });
    expect(putResponse.ok).toBe(true);

    // 3. Confirm
    const confirmResponse = await request(app.getHttpServer())
      .post(`/v1/assets/${publicId}/confirm`)
      .set("Authorization", "Bearer test-token");
    expect(confirmResponse.status).toBe(200);

    // 4. Preview URL (uses the system 'lafken:thumbnail' preset)
    const presetName = "lafken:thumbnail";
    const previewResponse = await request(app.getHttpServer())
      .get(`/v1/assets/${publicId}/preview-url`)
      .query({ preset: presetName })
      .set("Authorization", "Bearer test-token");
    expect(previewResponse.status).toBe(200);

    // 5. Download URL
    const downloadResponse = await request(app.getHttpServer())
      .get(`/v1/assets/${publicId}/download-url`)
      .set("Authorization", "Bearer test-token");
    expect(downloadResponse.status).toBe(200);

    await metricsHandle.forceFlush();

    // Upload metrics
    expect(
      findCounterPoint(metricsHandle.exporter, LAFKEN_METRIC_NAMES.UPLOAD_INTENT_CREATED)?.value,
      "lafken.upload.intent.created should fire on POST /upload-intents",
    ).toBeGreaterThanOrEqual(1);
    expect(
      findCounterPoint(metricsHandle.exporter, LAFKEN_METRIC_NAMES.UPLOAD_CONFIRMED)?.value,
      "lafken.upload.confirmed should fire on POST /:publicId/confirm",
    ).toBeGreaterThanOrEqual(1);

    // Serving metrics — preview
    const previewIssued = findCounterPoint(
      metricsHandle.exporter,
      LAFKEN_METRIC_NAMES.SERVING_PREVIEW_URL_ISSUED,
      { namespace_slug: namespaceSlug, preset_name: presetName },
    );
    expect(previewIssued?.value).toBeGreaterThanOrEqual(1);
    expect(previewIssued?.attributes["namespace_slug"]).toBe(namespaceSlug);
    expect(previewIssued?.attributes["preset_name"]).toBe(presetName);

    // Preview URL duration histogram — exists as a histogram point
    const collected = metricsHandle.exporter.getMetrics();
    const previewDurationPresent = collected.some((batch) =>
      batch.scopeMetrics.some((scope) =>
        scope.metrics.some(
          (descriptor) =>
            descriptor.descriptor.name === LAFKEN_METRIC_NAMES.SERVING_PREVIEW_URL_DURATION &&
            descriptor.dataPoints.length > 0,
        ),
      ),
    );
    expect(
      previewDurationPresent,
      "lafken.serving.preview_url.duration histogram should record at least one observation",
    ).toBe(true);

    // Serving metrics — download
    expect(
      findCounterPoint(metricsHandle.exporter, LAFKEN_METRIC_NAMES.SERVING_DOWNLOAD_URL_ISSUED, {
        namespace_slug: namespaceSlug,
      })?.value,
      "lafken.serving.download_url.issued should fire on GET /:publicId/download-url",
    ).toBeGreaterThanOrEqual(1);

    // Authorization decision counter — at least one decision was emitted by the
    // allow-all adapter for the requests made during this scenario.
    const authzDecisionFired = collected.some((batch) =>
      batch.scopeMetrics.some((scope) =>
        scope.metrics.some(
          (descriptor) =>
            descriptor.descriptor.name === LAFKEN_METRIC_NAMES.AUTHZ_DECISION &&
            descriptor.dataPoints.length > 0,
        ),
      ),
    );
    expect(
      authzDecisionFired,
      "lafken.authz.decision should fire from the authorization adapter",
    ).toBe(true);
  });
});
