import { AsyncLocalStorage } from "node:async_hooks";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ConfirmUploadUseCase } from "@/assets/application/use-cases/confirm-upload.use-case";
import { AssetQueryRepository } from "@/assets/infrastructure/persistence/repositories/asset-query.repository";
import { AssetWriteRepository } from "@/assets/infrastructure/persistence/repositories/asset-write.repository";
import { UploadIntentWriteRepository } from "@/assets/infrastructure/persistence/repositories/upload-intent-write.repository";
import { AuditWriteRepository } from "@/audit/infrastructure/persistence/repositories/audit-write.repository";
import { NamespaceQueryRepository } from "@/namespaces/infrastructure/persistence/repositories/namespace-query.repository";
import { ConnectionResolver } from "@/shared/infrastructure/persistence/connection-resolver";
import { DatabaseAsyncLocalStorage } from "@/shared/infrastructure/persistence/database-async-local-storage";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";
import { DatabaseUnitOfWork } from "@/shared/infrastructure/persistence/database-unit-of-work";
import { StorageBindingQueryRepository } from "@/system/infrastructure/persistence/repositories/storage-binding-query.repository";

import { FakeAssetStorage } from "../../../__fakes__/fake-asset-storage";
import { FakeMetricsPort } from "../../../__fakes__/fake-metrics.port";
import { cleanDatabase } from "../../helpers/clean-database";
import { createTestDatabaseClient } from "../../helpers/create-test-database-client";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

describe("[Integration] ConfirmUploadUseCase — UoW rollback", () => {
  let db: DatabaseClient;
  let resolver: ConnectionResolver;
  let als: DatabaseAsyncLocalStorage;
  let unitOfWork: DatabaseUnitOfWork;
  let auditWriteRepo: AuditWriteRepository;
  let useCase: ConfirmUploadUseCase;

  let bindingId: string;
  let namespaceId: string;
  let policyVersionId: string;

  beforeAll(async () => {
    db = await createTestDatabaseClient();
    als = new DatabaseAsyncLocalStorage(new AsyncLocalStorage());
    resolver = new ConnectionResolver(db, als);
    unitOfWork = new DatabaseUnitOfWork(als, db);

    const intentRepo = new UploadIntentWriteRepository(db);
    const assetWriteRepo = new AssetWriteRepository(db, resolver);
    const assetQueryRepo = new AssetQueryRepository(db);
    const namespaceQueryRepo = new NamespaceQueryRepository(db, resolver);
    const storageBindingQueryRepo = new StorageBindingQueryRepository(db);
    const fakeStorage = new FakeAssetStorage();
    fakeStorage.existsResult = true; // object always exists for this test

    auditWriteRepo = new AuditWriteRepository(resolver);

    useCase = new ConfirmUploadUseCase(
      intentRepo,
      assetWriteRepo,
      fakeStorage,
      namespaceQueryRepo,
      storageBindingQueryRepo,
      assetQueryRepo,
      auditWriteRepo,
      new FakeMetricsPort(),
      unitOfWork,
    );
  });

  afterAll(async () => {
    await db.closeConnection();
  });

  beforeEach(async () => {
    vi.restoreAllMocks();

    await cleanDatabase(db);

    // Seed storage binding
    const sb = await db.connection
      .insertInto("storage_bindings")
      .values({
        name: "test-binding",
        adapter_type: "gcs",
        config: { bucket: "lafken-dev", projectId: "test-project" },
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    bindingId = (sb as { id: string }).id;

    // Seed namespace + policy in a single transaction (deferrable FK on current_policy_id)
    const seeded = await db.connection.transaction().execute(async (tx) => {
      const ns = await tx
        .insertInto("namespaces")
        .values({
          slug: "aircraft-photos",
          display_name: "Aircraft Photos",
          description: null,
          current_policy_id: NIL_UUID,
          storage_binding_id: bindingId,
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      const nsId = (ns as { id: string }).id;

      const policy = await tx
        .insertInto("namespace_policies")
        .values({
          namespace_id: nsId,
          version: 1,
          retention_days: null,
          retention_mode: "none",
          max_file_size_bytes: 52_428_800n,
          allowed_mime_types: ["image/jpeg"],
          exif_handling: "strip",
          virus_scan_required: false,
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
      const pvId = (policy as { id: string }).id;

      await tx
        .updateTable("namespaces")
        .set({ current_policy_id: pvId })
        .where("id", "=", nsId)
        .execute();

      return { namespaceId: nsId, policyVersionId: pvId };
    });

    namespaceId = seeded.namespaceId;
    policyVersionId = seeded.policyVersionId;
  });

  it("rolls back asset and state-transition writes when the audit-log write throws", async () => {
    // Seed an upload intent
    const futureExpiry = new Date(Date.now() + 3600 * 1000);
    const intent = await db.connection
      .insertInto("upload_intents")
      .values({
        namespace_id: namespaceId,
        policy_version_id: policyVersionId,
        storage_binding_id: bindingId,
        storage_key: "uploads/test-asset.jpg",
        declared_mime_type: "image/jpeg",
        declared_size_bytes: 4096n,
        upload_url: "https://storage.example.com/X-Goog-Signature=signed",
        upload_url_expires_at: futureExpiry,
        created_by: null,
      })
      .returning("public_id")
      .executeTakeFirstOrThrow();
    const publicId = (intent as { public_id: string }).public_id;

    // Spy on the AuditWriteRepository.record to throw — this bypasses the
    // internal try/catch so the error propagates up to the UoW block.
    vi.spyOn(auditWriteRepo, "record").mockRejectedValueOnce(new Error("simulated audit failure"));

    await expect(
      useCase.execute({
        publicId,
        uploadedBy: "ops@latam.com",
        requestIp: null,
      }),
    ).rejects.toThrow("simulated audit failure");

    // After rollback: no asset rows should have been persisted
    const assets = await db.connection.selectFrom("assets").selectAll().execute();
    expect(assets).toHaveLength(0);

    // No state transition rows either
    const transitions = await db.connection
      .selectFrom("asset_state_transitions")
      .selectAll()
      .execute();
    expect(transitions).toHaveLength(0);

    // No processing job rows either
    const jobs = await db.connection.selectFrom("processing_jobs").selectAll().execute();
    expect(jobs).toHaveLength(0);

    // The upload intent's consumed_at must still be null (rollback)
    const intentRow = await db.connection
      .selectFrom("upload_intents")
      .select("consumed_at")
      .where("public_id", "=", publicId)
      .executeTakeFirstOrThrow();
    expect((intentRow as { consumed_at: Date | null }).consumed_at).toBeNull();
  });
});
