import type { INestApplication } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { OrphanUploadIntentSweeperUseCase } from "@/assets/application/processing/orphan-upload-intent-sweeper.use-case";
import { AssetsProcessingWorkerModule } from "@/assets/assets-processing-worker.module";
import { AppLoggerPort } from "@/shared/application/app-logger.port";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { NoopApplicationWithErrorLoggerMock } from "../../../../__mocks__/noop-app-logger.service";
import { createAppModuleForE2ETest } from "../../../__fixtures__/app-module-factory";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

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

describe("[E2E] OrphanUploadIntentSweeperUseCase", () => {
  let app: INestApplication;
  let db: DatabaseClient;
  let workerModule: TestingModule;
  let sweeper: OrphanUploadIntentSweeperUseCase;
  let storageBindingId: string;
  let namespaceId: string;
  let policyVersionId: string;

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

    sweeper = workerModule.get(OrphanUploadIntentSweeperUseCase);
  });

  afterAll(async () => {
    await workerModule.close();
    await app.close();
  });

  beforeEach(async () => {
    await db.connection.transaction().execute(async (tx) => {
      await tx.deleteFrom("upload_intents").execute();
      await tx.deleteFrom("configuration_audit_log").execute();
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
        name: "test-binding",
        adapter_type: "gcs",
        config: { bucket: "lafken-dev", projectId: "fake-project-1" },
      })
      .returningAll()
      .execute();

    storageBindingId = (bindingRow as { id: string }).id;

    namespaceId = await db.connection.transaction().execute(async (tx) => {
      const [nsRow] = await tx
        .insertInto("namespaces")
        .values({
          slug: "orphan-sweep-ns",
          display_name: "Orphan Sweep Test Namespace",
          current_policy_id: NIL_UUID,
          storage_binding_id: storageBindingId,
        })
        .returningAll()
        .execute();

      const nsId = (nsRow as { id: string }).id;

      const [policyRow] = await tx
        .insertInto("namespace_policies")
        .values({
          namespace_id: nsId,
          version: 1,
          ...VALID_DB_POLICY_VALUES,
        })
        .returningAll()
        .execute();

      const polId = (policyRow as { id: string }).id;
      policyVersionId = polId;

      await tx
        .updateTable("namespaces")
        .set({ current_policy_id: polId })
        .where("id", "=", nsId)
        .execute();

      return nsId;
    });
  });

  async function insertIntentRaw(opts: {
    uploadUrlExpiresAt: Date;
    consumedAt?: Date;
  }): Promise<{ publicId: string }> {
    const [row] = await db.connection
      .insertInto("upload_intents")
      .values({
        namespace_id: namespaceId,
        policy_version_id: policyVersionId,
        storage_binding_id: storageBindingId,
        storage_key: `uploads/test-intent-${Date.now()}.jpg`,
        declared_mime_type: "image/jpeg",
        declared_size_bytes: BigInt(1_048_576),
        upload_url: "https://fake-gcs.local/upload/stub",
        upload_url_expires_at: opts.uploadUrlExpiresAt,
        consumed_at: opts.consumedAt ?? undefined,
        created_by: "ops@latam.com",
      })
      .returningAll()
      .execute();

    return { publicId: (row as { public_id: string }).public_id };
  }

  it("expires intents past grace and audits upload_intent.expired", async () => {
    const intent = await insertIntentRaw({
      uploadUrlExpiresAt: new Date(Date.now() - 10 * 60_000),
    });

    await sweeper.execute({
      now: new Date(),
      graceMs: 5 * 60_000,
      batchSize: 50,
    });

    const row = await db.connection
      .selectFrom("upload_intents")
      .select(["expired_at"])
      .where("public_id", "=", intent.publicId)
      .executeTakeFirstOrThrow();

    expect(row.expired_at).not.toBeNull();

    const audit = await db.connection
      .selectFrom("configuration_audit_log")
      .selectAll()
      .where("entity_type", "=", "upload_intent")
      .where("entity_id", "=", intent.publicId)
      .where("action", "=", "expired")
      .executeTakeFirstOrThrow();

    expect(audit).toBeTruthy();
  });

  it("leaves consumed intents alone", async () => {
    const intent = await insertIntentRaw({
      uploadUrlExpiresAt: new Date(Date.now() - 10 * 60_000),
      consumedAt: new Date(),
    });

    await sweeper.execute({
      now: new Date(),
      graceMs: 5 * 60_000,
      batchSize: 50,
    });

    const row = await db.connection
      .selectFrom("upload_intents")
      .select(["expired_at"])
      .where("public_id", "=", intent.publicId)
      .executeTakeFirstOrThrow();

    expect(row.expired_at).toBeNull();
  });
});
