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

const NIL_UUID = "00000000-0000-0000-0000-000000000000";
// eslint-disable-next-line no-process-env
const GATE = process.env["LAFKEN_E2E_REQUIRES_FAKE_GCS"] === "true";

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

describe.skipIf(!GATE)("[E2E] serving metrics", () => {
  let app: INestApplication;
  let db: DatabaseClient;
  let storageBindingId: string;
  let metricsHandle: IMetricReaderHandle;

  beforeAll(async () => {
    // Install before app boot so the meter cached at module-load time binds to
    // the in-memory provider rather than the production OTEL provider.
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
      await tx.deleteFrom("asset_analyses").execute();
      await tx.deleteFrom("asset_state_transitions").execute();
      await tx.deleteFrom("processing_jobs").execute();
      await tx.deleteFrom("legal_hold_assets").execute();
      await tx.deleteFrom("legal_holds").execute();
      await tx.deleteFrom("assets").execute();
      await tx.deleteFrom("namespace_presets").execute();
      await tx.deleteFrom("upload_intents").execute();
      await tx.deleteFrom("namespace_policies").execute();
      await tx.deleteFrom("namespaces").execute();
      await tx.deleteFrom("storage_bindings").execute();
    });

    const [bindingRow] = await db.connection
      .insertInto("storage_bindings")
      .values({
        name: "serving-metrics-binding",
        adapter_type: "gcs",
        config: { bucket: "lafken-dev", projectId: "fake-project-1" },
      })
      .returningAll()
      .execute();

    storageBindingId = (bindingRow as { id: string }).id;
  });

  async function insertNamespace(slug: string): Promise<{ namespaceId: string; policyId: string }> {
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
      return { namespaceId, policyId };
    });
  }

  async function insertAsset(input: {
    namespaceId: string;
    policyVersionId: string;
  }): Promise<{ publicId: string }> {
    const [assetRow] = await db.connection
      .insertInto("assets")
      .values({
        namespace_id: input.namespaceId,
        policy_version_id: input.policyVersionId,
        storage_binding_id: storageBindingId,
        storage_key: "ns/asset-key.jpg",
        state: "uploaded",
        mime_type: "image/jpeg",
        size_bytes: BigInt(1024),
        effective_max_size_bytes: BigInt(52_428_800),
        effective_url_ttl: 3600,
      })
      .returningAll()
      .execute();
    return { publicId: (assetRow as { public_id: string }).public_id };
  }

  it("emits lafken.serving.preview_url.issued with namespace_slug + preset_name", async () => {
    const { namespaceId, policyId } = await insertNamespace("preview-metric-ns");
    const { publicId } = await insertAsset({ namespaceId, policyVersionId: policyId });

    const response = await request(app.getHttpServer())
      .get(`/v1/assets/${publicId}/preview-url`)
      .query({ preset: "lafken:thumbnail" })
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(200);

    await metricsHandle.forceFlush();

    expect(
      findCounterPoint(metricsHandle.exporter, LAFKEN_METRIC_NAMES.SERVING_PREVIEW_URL_ISSUED, {
        namespace_slug: "preview-metric-ns",
        preset_name: "lafken:thumbnail",
      })?.value,
    ).toBe(1);
  });

  it("emits lafken.serving.download_url.issued with namespace_slug", async () => {
    const { namespaceId, policyId } = await insertNamespace("download-metric-ns");
    const { publicId } = await insertAsset({ namespaceId, policyVersionId: policyId });

    const response = await request(app.getHttpServer())
      .get(`/v1/assets/${publicId}/download-url`)
      .set("Authorization", "Bearer test-token");

    expect(response.status).toBe(200);

    await metricsHandle.forceFlush();

    expect(
      findCounterPoint(metricsHandle.exporter, LAFKEN_METRIC_NAMES.SERVING_DOWNLOAD_URL_ISSUED, {
        namespace_slug: "download-metric-ns",
      })?.value,
    ).toBe(1);
  });
});
