import { AsyncLocalStorage } from "node:async_hooks";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { AuditWriteRepository } from "@/audit/infrastructure/persistence/repositories/audit-write.repository";
import { LiftLegalHoldUseCase } from "@/legal-holds/application/use-cases/lift-legal-hold.use-case";
import { LegalHoldAlreadyLiftedError } from "@/legal-holds/domain/errors/legal-hold-already-lifted.error";
import { LegalHoldQueryRepository } from "@/legal-holds/infrastructure/persistence/repositories/legal-hold-query.repository";
import { LegalHoldWriteRepository } from "@/legal-holds/infrastructure/persistence/repositories/legal-hold-write.repository";
import { ConnectionResolver } from "@/shared/infrastructure/persistence/connection-resolver";
import { DatabaseAsyncLocalStorage } from "@/shared/infrastructure/persistence/database-async-local-storage";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";
import { DatabaseUnitOfWork } from "@/shared/infrastructure/persistence/database-unit-of-work";

import { cleanDatabase } from "../../helpers/clean-database";
import { createTestDatabaseClient } from "../../helpers/create-test-database-client";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

describe("[Integration] LiftLegalHoldUseCase — concurrent lifts", () => {
  let db: DatabaseClient;
  let unitOfWork: DatabaseUnitOfWork;
  let queryRepo: LegalHoldQueryRepository;
  let writeRepo: LegalHoldWriteRepository;
  let auditWriteRepo: AuditWriteRepository;
  let useCase: LiftLegalHoldUseCase;

  let bindingId: string;
  let namespaceId: string;
  let assetA: string;

  beforeAll(async () => {
    db = await createTestDatabaseClient();
    const als = new DatabaseAsyncLocalStorage(new AsyncLocalStorage());
    const resolver = new ConnectionResolver(db, als);
    unitOfWork = new DatabaseUnitOfWork(als, db);

    queryRepo = new LegalHoldQueryRepository(db);
    writeRepo = new LegalHoldWriteRepository(db, resolver);
    auditWriteRepo = new AuditWriteRepository(resolver);

    useCase = new LiftLegalHoldUseCase(queryRepo, writeRepo, auditWriteRepo, unitOfWork);
  });

  afterAll(async () => {
    await db.closeConnection();
  });

  beforeEach(async () => {
    await cleanDatabase(db);

    const sb = await db.connection
      .insertInto("storage_bindings")
      .values({
        name: "test-concurrency",
        adapter_type: "gcs",
        config: { bucket: "lafken-dev", projectId: "p" },
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    bindingId = (sb as { id: string }).id;

    const seeded = await db.connection.transaction().execute(async (tx) => {
      const ns = await tx
        .insertInto("namespaces")
        .values({
          slug: "ns-concurrency",
          display_name: "NS Concurrency",
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
          max_file_size_bytes: 1,
          allowed_mime_types: ["image/jpeg"],
          exif_handling: "strip",
          virus_scan_required: true,
          content_moderation: null,
          required_metadata_schema: null,
          immutable: false,
          serving_mode: "public",
          signed_url_ttl_seconds: null,
          signed_url_bucket_size: null,
          retry_config: null,
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

    const inserted = await db.connection
      .insertInto("assets")
      .values({
        namespace_id: namespaceId,
        policy_version_id: seeded.policyVersionId,
        state: "ready",
        storage_binding_id: bindingId,
        storage_key: "ns-concurrency/a/source",
        declared_mime_type: "image/jpeg",
        uploaded_by: "u@example.com",
        effective_max_size_bytes: 52_428_800n,
        effective_url_ttl: 3600,
      })
      .returning(["id"])
      .executeTakeFirstOrThrow();
    assetA = (inserted as { id: string }).id;
  });

  it("under two concurrent lift attempts, exactly one wins, the loser errors, compliance fields are not overwritten, and exactly one audit row is written", async () => {
    const placed = await writeRepo.placeHold({
      caseReference: "CHL-AVN-2026-RACE",
      description: "Hold used to prove the concurrent-lift race guard.",
      scopeSummary: "1 asset(s) across namespace ns-concurrency",
      placedBy: "ops@example.com",
      assetInternalIds: [assetA],
    });

    const [resultA, resultB] = await Promise.allSettled([
      useCase.execute({
        holdId: placed.props.id,
        liftedBy: "racer-a@example.com",
        liftReason: "Racer A closes the case.",
        requestIp: null,
      }),
      useCase.execute({
        holdId: placed.props.id,
        liftedBy: "racer-b@example.com",
        liftReason: "Racer B closes the case.",
        requestIp: null,
      }),
    ]);

    const settled = [resultA, resultB];
    const fulfilled = settled.filter(
      (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof useCase.execute>>> =>
        r.status === "fulfilled",
    );
    const rejected = settled.filter((r): r is PromiseRejectedResult => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toBeInstanceOf(LegalHoldAlreadyLiftedError);

    const winnerLiftedBy = fulfilled[0]?.value.props.liftedBy;
    expect(["racer-a@example.com", "racer-b@example.com"]).toContain(winnerLiftedBy);

    // The DB row must reflect the winner only — the loser never overwrote it.
    const [row] = await db.connection
      .selectFrom("legal_holds")
      .select(["lifted_by", "lift_reason"])
      .where("id", "=", placed.props.id)
      .execute();
    expect(row?.lifted_by).toBe(winnerLiftedBy);
    expect(row?.lift_reason).toBe(
      winnerLiftedBy === "racer-a@example.com"
        ? "Racer A closes the case."
        : "Racer B closes the case.",
    );

    // Exactly one audit row — the loser's transaction rolled back before its
    // (never-reached) audit write, and the winner recorded exactly once.
    const auditRows = await db.connection
      .selectFrom("configuration_audit_log")
      .select(["occurred_by"])
      .where("entity_id", "=", placed.props.id)
      .where("action", "=", "lift")
      .execute();
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]?.occurred_by).toBe(winnerLiftedBy);

    // The only hold covering the asset was lifted, so the flag is cleared.
    const [assetRow] = await db.connection
      .selectFrom("assets")
      .select(["legal_hold", "legal_hold_reference"])
      .where("id", "=", assetA)
      .execute();
    expect(assetRow?.legal_hold).toBe(false);
    expect(assetRow?.legal_hold_reference).toBeNull();
  });
});
