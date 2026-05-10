import { AsyncLocalStorage } from "node:async_hooks";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AssetQueryRepository } from "@/assets/infrastructure/persistence/repositories/asset-query.repository";
import { AuditWriteRepository } from "@/audit/infrastructure/persistence/repositories/audit-write.repository";
import { PlaceLegalHoldUseCase } from "@/legal-holds/application/use-cases/place-legal-hold.use-case";
import { LegalHoldWriteRepository } from "@/legal-holds/infrastructure/persistence/repositories/legal-hold-write.repository";
import { ConnectionResolver } from "@/shared/infrastructure/persistence/connection-resolver";
import { DatabaseAsyncLocalStorage } from "@/shared/infrastructure/persistence/database-async-local-storage";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";
import { DatabaseUnitOfWork } from "@/shared/infrastructure/persistence/database-unit-of-work";

import { NoopApplicationWithErrorLoggerMock } from "../../../__mocks__/noop-app-logger.service";
import { createTestDatabaseClient } from "../../helpers/create-test-database-client";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

describe("[Integration] PlaceLegalHoldUseCase — UoW rollback", () => {
  let db: DatabaseClient;
  let resolver: ConnectionResolver;
  let als: DatabaseAsyncLocalStorage;
  let unitOfWork: DatabaseUnitOfWork;
  let auditWriteRepo: AuditWriteRepository;
  let useCase: PlaceLegalHoldUseCase;

  let bindingId: string;
  let namespaceId: string;
  let assetIdA: string;
  let assetIdB: string;
  let assetPublicIdA: string;
  let assetPublicIdB: string;

  beforeAll(async () => {
    db = await createTestDatabaseClient();
    als = new DatabaseAsyncLocalStorage(new AsyncLocalStorage());
    resolver = new ConnectionResolver(db, als);
    unitOfWork = new DatabaseUnitOfWork(als, db);

    const logger = new NoopApplicationWithErrorLoggerMock();

    const assetQueryRepo = new AssetQueryRepository(db);
    const legalHoldWriteRepo = new LegalHoldWriteRepository(db, resolver);
    auditWriteRepo = new AuditWriteRepository(resolver, logger);

    useCase = new PlaceLegalHoldUseCase(
      assetQueryRepo,
      legalHoldWriteRepo,
      auditWriteRepo,
      unitOfWork,
    );
  });

  afterAll(async () => {
    await db.closeConnection();
  });

  beforeEach(async () => {
    vi.restoreAllMocks();

    // Clean all tables in FK-safe order
    await db.connection.transaction().execute(async (tx) => {
      await tx.deleteFrom("legal_hold_assets").execute();
      await tx.deleteFrom("legal_holds").execute();
      await tx.deleteFrom("asset_analyses").execute();
      await tx.deleteFrom("asset_state_transitions").execute();
      await tx.deleteFrom("processing_jobs").execute();
      await tx.deleteFrom("assets").execute();
      await tx.deleteFrom("upload_intents").execute();
      await tx.deleteFrom("configuration_audit_log").execute();
      await tx.deleteFrom("namespace_presets").execute();
      await tx.deleteFrom("namespace_policies").execute();
      await tx.deleteFrom("namespaces").execute();
      await tx.deleteFrom("storage_bindings").execute();
    });

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

    // Seed two assets in ready state
    const insertedAssets = await db.connection
      .insertInto("assets")
      .values([
        {
          namespace_id: namespaceId,
          policy_version_id: seeded.policyVersionId,
          state: "ready",
          storage_binding_id: bindingId,
          storage_key: "aircraft-photos/a.jpg",
          declared_mime_type: "image/jpeg",
          uploaded_by: "ops@latam.com",
          effective_max_size_bytes: 52_428_800n,
          effective_url_ttl: 3600,
        },
        {
          namespace_id: namespaceId,
          policy_version_id: seeded.policyVersionId,
          state: "ready",
          storage_binding_id: bindingId,
          storage_key: "aircraft-photos/b.jpg",
          declared_mime_type: "image/jpeg",
          uploaded_by: "ops@latam.com",
          effective_max_size_bytes: 52_428_800n,
          effective_url_ttl: 3600,
        },
      ])
      .returning(["id", "public_id"])
      .execute();

    assetIdA = (insertedAssets[0] as { id: string }).id;
    assetIdB = (insertedAssets[1] as { id: string }).id;
    assetPublicIdA = (insertedAssets[0] as { public_id: string }).public_id;
    assetPublicIdB = (insertedAssets[1] as { public_id: string }).public_id;
  });

  it("rolls back legal_hold and legal_hold_assets writes when the audit-log write throws", async () => {
    // Spy on AuditWriteRepository.record to throw — bypasses the internal
    // try/catch so the error propagates up to the UoW block.
    vi.spyOn(auditWriteRepo, "record").mockRejectedValueOnce(new Error("simulated audit failure"));

    await expect(
      useCase.execute({
        caseReference: "CHL-AVN-2026-TEST-001",
        description: "Integration test hold for rollback verification.",
        assetIds: [assetPublicIdA, assetPublicIdB],
        placedBy: "ops@latam.com",
        requestIp: null,
      }),
    ).rejects.toThrow("simulated audit failure");

    // After rollback: no legal_holds rows should have been persisted
    const holds = await db.connection.selectFrom("legal_holds").selectAll().execute();
    expect(holds).toHaveLength(0);

    // No legal_hold_assets M2M rows either
    const m2m = await db.connection.selectFrom("legal_hold_assets").selectAll().execute();
    expect(m2m).toHaveLength(0);

    // The assets' legal_hold flag must remain false (rolled back)
    const assets = await db.connection
      .selectFrom("assets")
      .select(["id", "legal_hold", "legal_hold_reference"])
      .where("id", "in", [assetIdA, assetIdB])
      .execute();
    expect(assets).toHaveLength(2);
    expect(assets.every((r) => r.legal_hold === false)).toBe(true);
    expect(assets.every((r) => r.legal_hold_reference === null)).toBe(true);
  });
});
