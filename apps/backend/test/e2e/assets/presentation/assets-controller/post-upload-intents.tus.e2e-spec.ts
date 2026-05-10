import type { INestApplication } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { AppModule } from "@/app.module";
import { UploadUrlIssuerPort } from "@/assets/domain/services/upload-url-issuer.service.port";
import { CompositeUploadUrlIssuer } from "@/assets/infrastructure/services/composite-upload-url-issuer";
import { TusdUploadUrlIssuer } from "@/assets/infrastructure/services/tusd-upload-url-issuer.adapter";
import { setupApp } from "@/setup-main-app";
import { AppLoggerPort } from "@/shared/application/app-logger.port";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { mintDevOidcToken } from "../../../../__fixtures__/dev-oidc-token";
import { NoopApplicationWithErrorLoggerMock } from "../../../../__mocks__/noop-app-logger.service";
import { createAppModuleForE2ETest } from "../../../__fixtures__/app-module-factory";
import { truncateAllAssetTables } from "../../../common/database-cleanup.helper";

// --------------------------------------------------------------------------
// Constants shared across both app fixtures
// --------------------------------------------------------------------------

const TUSD_STUB_ENDPOINT = "http://tusd-stub.test/files/";

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

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

// --------------------------------------------------------------------------
// Helper: create an app with a real TusdUploadUrlIssuer injected
// --------------------------------------------------------------------------

async function createAppWithTusd(): Promise<{
  app: INestApplication;
  db: DatabaseClient;
}> {
  const tusdIssuer = new TusdUploadUrlIssuer({ endpointUrl: TUSD_STUB_ENDPOINT });
  // Wrap in CompositeUploadUrlIssuer with no GCS issuer (not needed for these tests)
  const issuer = new CompositeUploadUrlIssuer({ gcs: tusdIssuer, tusd: tusdIssuer });

  const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(AppLoggerPort)
    .useClass(NoopApplicationWithErrorLoggerMock)
    .overrideProvider(UploadUrlIssuerPort)
    .useValue(issuer)
    .compile();

  const app = moduleFixture.createNestApplication<NestExpressApplication>({
    bufferLogs: true,
    abortOnError: false,
    autoFlushLogs: false,
  });
  setupApp(app);
  app.useLogger(false);
  await app.init();

  return { app, db: app.get(DatabaseClient) };
}

// --------------------------------------------------------------------------
// Suite
// --------------------------------------------------------------------------

describe("[E2E] POST /v1/assets/upload-intents — tus protocol", () => {
  // App that has a tusd issuer configured
  let appWithTus: INestApplication;
  let appWithTusDb: DatabaseClient;

  // App where TUSD_ENDPOINT_URL is unset (default test env)
  let appWithoutTus: INestApplication;
  let appWithoutTusDb: DatabaseClient;

  let storageBindingId: string;

  beforeAll(async () => {
    const withTus = await createAppWithTusd();
    appWithTus = withTus.app;
    appWithTusDb = withTus.db;

    const withoutTus = await createAppModuleForE2ETest();
    appWithoutTus = withoutTus.appFixture;
    appWithoutTusDb = withoutTus.getDatabaseClient();
    await appWithoutTus.init();
  });

  afterAll(async () => {
    await appWithTus.close();
    await appWithoutTus.close();
  });

  beforeEach(async () => {
    // Clean up using appWithTusDb (both apps share the same underlying DB)
    await truncateAllAssetTables(appWithTusDb);

    const [bindingRow] = await appWithTusDb.connection
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

  async function insertNamespace(db: DatabaseClient, slug: string): Promise<string> {
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

  it("returns a tus URL when protocol='tus' and TUSD_ENDPOINT_URL is set", async () => {
    await insertNamespace(appWithTusDb, "tus-ns");

    const res = await request(appWithTus.getHttpServer())
      .post("/v1/assets/upload-intents")
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "carlos.cima" })}`)
      .send({
        namespaceSlug: "tus-ns",
        declaredMimeType: "image/jpeg",
        declaredSizeBytes: 1024,
        protocol: "tus",
      });

    expect(res.status).toBe(201);
    expect(res.body.protocol).toBe("tus");
    expect(res.body.uploadUrl).toMatch(/^http:\/\/tusd-stub\.test\/files\//);
    expect(res.body.uploadHeaders["Tus-Resumable"]).toBe("1.0.0");
    // Upload-Length is set to the policy's maxFileSizeBytes (50 MiB), not
    // the declaredSizeBytes — it caps how much tusd will accept, not how
    // much the client intends to send.
    expect(res.body.uploadHeaders["Upload-Length"]).toBe("52428800");
  });

  it("returns 422 with TusNotConfiguredError when TUSD_ENDPOINT_URL is unset", async () => {
    await insertNamespace(appWithoutTusDb, "tus-ns");

    const res = await request(appWithoutTus.getHttpServer())
      .post("/v1/assets/upload-intents")
      .set("Authorization", `Bearer ${await mintDevOidcToken({ profileId: "carlos.cima" })}`)
      .send({
        namespaceSlug: "tus-ns",
        declaredMimeType: "image/jpeg",
        declaredSizeBytes: 1024,
        protocol: "tus",
      });

    expect(res.status).toBe(422);
    expect(res.headers["content-type"]).toMatch(/problem\+json/);
    expect(res.body.type).toMatch(/tus-not-configured-error/);
  });
});
