import { AsyncLocalStorage } from "node:async_hooks";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AssetQueryRepository } from "@/assets/infrastructure/persistence/repositories/asset-query.repository";
import { AssetWriteRepository } from "@/assets/infrastructure/persistence/repositories/asset-write.repository";
import { AuditWriteRepository } from "@/audit/infrastructure/persistence/repositories/audit-write.repository";
import { ReleaseQuarantinedAssetUseCase } from "@/quarantine/application/use-cases/release-quarantined-asset.use-case";
import { ConnectionResolver } from "@/shared/infrastructure/persistence/connection-resolver";
import { DatabaseAsyncLocalStorage } from "@/shared/infrastructure/persistence/database-async-local-storage";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";
import { DatabaseUnitOfWork } from "@/shared/infrastructure/persistence/database-unit-of-work";
import { StorageBindingQueryRepository } from "@/system/infrastructure/persistence/repositories/storage-binding-query.repository";

import { FakeAssetStorage } from "../../../__fakes__/fake-asset-storage";
import { cleanDatabase } from "../../helpers/clean-database";
import { createTestDatabaseClient } from "../../helpers/create-test-database-client";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

describe("[Integration] ReleaseQuarantinedAssetUseCase — UoW atomicity", () => {
  let db: DatabaseClient;
  let resolver: ConnectionResolver;
  let als: DatabaseAsyncLocalStorage;
  let unitOfWork: DatabaseUnitOfWork;
  let auditWriteRepo: AuditWriteRepository;
  let useCase: ReleaseQuarantinedAssetUseCase;

  let bindingId: string;
  let namespaceId: string;
  let policyVersionId: string;

  beforeAll(async () => {
    db = await createTestDatabaseClient();
    als = new DatabaseAsyncLocalStorage(new AsyncLocalStorage());
    resolver = new ConnectionResolver(db, als);
    unitOfWork = new DatabaseUnitOfWork(als, db);

    const assetQueryRepo = new AssetQueryRepository(db);
    const assetWriteRepo = new AssetWriteRepository(db, resolver);
    const storageBindingQueryRepo = new StorageBindingQueryRepository(db);
    // The seeded asset below uses a legacy (non-`_quarantined/`-prefixed)
    // storage key, so the use case never calls moveObject/findById on these
    // — a real FakeAssetStorage is enough, no fake-gcs traffic needed for
    // this test's purpose (proving the DB-side transactional invariant).
    const fakeStorage = new FakeAssetStorage();
    auditWriteRepo = new AuditWriteRepository(resolver);

    useCase = new ReleaseQuarantinedAssetUseCase(
      assetQueryRepo,
      assetWriteRepo,
      fakeStorage,
      storageBindingQueryRepo,
      auditWriteRepo,
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

  async function seedQuarantinedAsset(): Promise<{ id: string; publicId: string }> {
    const inserted = await db.connection
      .insertInto("assets")
      .values({
        namespace_id: namespaceId,
        policy_version_id: policyVersionId,
        state: "quarantined_virus",
        storage_binding_id: bindingId,
        storage_key: "aircraft-photos/quarantine-target.jpg",
        declared_mime_type: "image/jpeg",
        uploaded_by: "ops@latam.com",
        effective_max_size_bytes: 52_428_800n,
        effective_url_ttl: 3600,
      })
      .returning(["id", "public_id"])
      .executeTakeFirstOrThrow();
    return {
      id: (inserted as { id: string }).id,
      publicId: (inserted as { public_id: string }).public_id,
    };
  }

  it("rolls back the state transition when the audit-log write throws", async () => {
    const { id: assetId, publicId } = await seedQuarantinedAsset();

    // Spy on AuditWriteRepository.record to throw — bypasses the internal
    // try/catch so the error propagates up to the UoW block.
    vi.spyOn(auditWriteRepo, "record").mockRejectedValueOnce(new Error("simulated audit failure"));

    await expect(
      useCase.execute({
        publicId,
        reviewerId: "reviewer@example.com",
        note: "manual override",
        requestIp: "10.0.0.9",
      }),
    ).rejects.toThrow("simulated audit failure");

    // After rollback: the asset must still be quarantined, not "ready".
    const assetRow = await db.connection
      .selectFrom("assets")
      .select(["state", "storage_key"])
      .where("id", "=", assetId)
      .executeTakeFirstOrThrow();
    expect(assetRow.state).toBe("quarantined_virus");

    // No asset_state_transitions row either — the whole write rolled back.
    const transitions = await db.connection
      .selectFrom("asset_state_transitions")
      .selectAll()
      .where("asset_id", "=", assetId)
      .execute();
    expect(transitions).toHaveLength(0);

    // And, critically, no audit row claiming the release happened.
    const auditRows = await db.connection
      .selectFrom("configuration_audit_log")
      .selectAll()
      .where("entity_type", "=", "asset")
      .where("entity_id", "=", publicId)
      .execute();
    expect(auditRows).toHaveLength(0);
  });

  it("commits both the state transition and the audit-log row together on success", async () => {
    const { id: assetId, publicId } = await seedQuarantinedAsset();

    const result = await useCase.execute({
      publicId,
      reviewerId: "reviewer@example.com",
      note: "manual override after sniff false-positive",
      requestIp: "10.0.0.9",
    });

    expect(result.props.state).toBe("ready");

    // The state transition landed for real.
    const assetRow = await db.connection
      .selectFrom("assets")
      .select(["state"])
      .where("id", "=", assetId)
      .executeTakeFirstOrThrow();
    expect(assetRow.state).toBe("ready");

    // The audit row landed for real too — queried directly, not through the
    // repository under test.
    const auditRows = await db.connection
      .selectFrom("configuration_audit_log")
      .selectAll()
      .where("entity_type", "=", "asset")
      .where("entity_id", "=", publicId)
      .execute();
    expect(auditRows).toHaveLength(1);
    const auditRow = auditRows[0] as Record<string, unknown>;
    expect(auditRow).toMatchObject({
      entity_type: "asset",
      entity_id: publicId,
      action: "release",
      occurred_by: "reviewer@example.com",
      before_state: { state: "quarantined_virus" },
      after_state: { state: "ready", storageKey: "aircraft-photos/quarantine-target.jpg" },
    });
    // `request_ip` is a Postgres `inet` column — it round-trips with a
    // subnet mask (e.g. "10.0.0.9/32"), so assert by substring like the
    // AuditWriteRepository integration spec does.
    expect(String(auditRow["request_ip"])).toContain("10.0.0.9");
    expect(String(auditRow["reason"])).toContain("released_from_quarantine");
  });
});
