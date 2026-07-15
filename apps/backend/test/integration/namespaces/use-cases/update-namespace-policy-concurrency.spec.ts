import { AsyncLocalStorage } from "node:async_hooks";

import { sql } from "kysely";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { AuditWriteRepository } from "@/audit/infrastructure/persistence/repositories/audit-write.repository";
import { UpdateNamespacePolicyUseCase } from "@/namespaces/application/use-cases/update-namespace-policy.use-case";
import { PolicyVersionConflictError } from "@/namespaces/domain/errors/policy-version-conflict.error";
import { NamespaceQueryRepository } from "@/namespaces/infrastructure/persistence/repositories/namespace-query.repository";
import { NamespaceWriteRepository } from "@/namespaces/infrastructure/persistence/repositories/namespace-write.repository";
import { ConnectionResolver } from "@/shared/infrastructure/persistence/connection-resolver";
import { DatabaseAsyncLocalStorage } from "@/shared/infrastructure/persistence/database-async-local-storage";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";
import { DatabaseUnitOfWork } from "@/shared/infrastructure/persistence/database-unit-of-work";

import { cleanDatabase } from "../../helpers/clean-database";
import { createTestDatabaseClient } from "../../helpers/create-test-database-client";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

const basePolicy = {
  retentionDays: 365,
  retentionMode: "delete" as const,
  maxFileSizeBytes: BigInt(50_000_000),
  allowedMimeTypes: ["image/jpeg", "image/png"],
  exifHandling: "strip" as const,
  virusScanRequired: true,
  contentModeration: null,
  requiredMetadataSchema: null,
  immutable: false,
  servingMode: "public" as const,
  signedUrlTtlSeconds: null,
  signedUrlBucketSize: null,
  retryConfig: null,
};

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolveFn: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    resolveFn = resolve;
  });
  return { promise, resolve: resolveFn };
}

describe("[Integration] createPolicyVersion under a concurrent writer (F-D1)", () => {
  let db: DatabaseClient; // connection A: repository + UoW
  let dbConcurrent: DatabaseClient; // connection B: the racing writer
  let resolver: ConnectionResolver;
  let unitOfWork: DatabaseUnitOfWork;
  let repository: NamespaceWriteRepository;
  let namespaceId: string;

  beforeAll(async () => {
    db = await createTestDatabaseClient();
    dbConcurrent = await createTestDatabaseClient();
    const als = new DatabaseAsyncLocalStorage(new AsyncLocalStorage());
    resolver = new ConnectionResolver(db, als);
    unitOfWork = new DatabaseUnitOfWork(als, db);
    repository = new NamespaceWriteRepository(db, resolver);
  });

  afterAll(async () => {
    await db.closeConnection();
    await dbConcurrent.closeConnection();
  });

  beforeEach(async () => {
    await cleanDatabase(db);

    // Raw-SQL seed: binding + namespace + policy v1 (deferrable FK trick).
    const sb = await db.connection
      .insertInto("storage_bindings")
      .values({ name: "test-binding", adapter_type: "gcs", config: { bucket: "lafken-dev" } })
      .returning("id")
      .executeTakeFirstOrThrow();
    const bindingId = (sb as { id: string }).id;

    const seeded = await db.connection.transaction().execute(async (tx) => {
      const ns = await tx
        .insertInto("namespaces")
        .values({
          slug: "race-ns",
          display_name: "Race NS",
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
          retention_days: 365,
          retention_mode: "delete",
          max_file_size_bytes: BigInt(50_000_000),
          allowed_mime_types: ["image/jpeg"],
          exif_handling: "strip",
          virus_scan_required: true,
          immutable: false,
          serving_mode: "public",
          created_by: "seed@test.com",
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      await tx
        .updateTable("namespaces")
        .set({ current_policy_id: (policy as { id: string }).id })
        .where("id", "=", nsId)
        .execute();

      return { namespaceId: nsId };
    });
    namespaceId = seeded.namespaceId;
  });

  /**
   * Polls pg_stat_activity until the repository's INSERT into
   * namespace_policies is blocked waiting on the concurrent writer's lock.
   * Deterministic: the INSERT cannot proceed until the writer commits, so
   * once observed blocked, ordering is guaranteed.
   */
  async function waitForBlockedPolicyInsert(): Promise<void> {
    for (let i = 0; i < 200; i += 1) {
      const result = await sql<{ pid: number }>`
        SELECT pid FROM pg_stat_activity
        WHERE state = 'active'
          AND wait_event_type = 'Lock'
          AND query ILIKE 'insert into "namespace_policies"%'
      `.execute(db.connection);
      if (result.rows.length > 0) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error("policy INSERT never blocked on the concurrent writer's lock");
  }

  /**
   * Starts a transaction on connection B that inserts version 2 and holds it
   * open until `release()` is called. Returns the settle promise.
   */
  function startConcurrentV2Writer(): { done: Promise<void>; release: () => void } {
    const gate = deferred();
    const done = dbConcurrent.connection.transaction().execute(async (tx) => {
      await tx
        .insertInto("namespace_policies")
        .values({
          namespace_id: namespaceId,
          version: 2,
          retention_days: 180,
          retention_mode: "delete",
          max_file_size_bytes: BigInt(50_000_000),
          allowed_mime_types: ["image/jpeg"],
          exif_handling: "strip",
          virus_scan_required: true,
          immutable: false,
          serving_mode: "public",
          created_by: "concurrent-writer@test.com",
        })
        .execute();
      await gate.promise;
    });
    return { done, release: gate.resolve };
  }

  it("translates the unique violation to PolicyVersionConflictError inside an ambient UoW instead of retrying on the aborted connection", async () => {
    const writer = startConcurrentV2Writer();

    const attempt = unitOfWork
      .execute(() =>
        repository.createPolicyVersion({
          namespaceId,
          policy: basePolicy,
          createdBy: "ops@latam.com",
        }),
      )
      .then(
        () => ({ outcome: "resolved" as const, error: null as unknown }),
        (error: unknown) => ({ outcome: "rejected" as const, error }),
      );

    await waitForBlockedPolicyInsert();
    writer.release();
    await writer.done;

    const result = await attempt;
    expect(result.outcome).toBe("rejected");
    expect(result.error).toBeInstanceOf(PolicyVersionConflictError);
  });

  it("lets UpdateNamespacePolicyUseCase win the race on its retry in a fresh transaction", async () => {
    const queryRepo = new NamespaceQueryRepository(db, resolver);
    const auditRepo = new AuditWriteRepository(resolver);
    const useCase = new UpdateNamespacePolicyUseCase(queryRepo, repository, auditRepo, unitOfWork);

    const writer = startConcurrentV2Writer();

    const attempt = useCase.execute({
      slug: "race-ns",
      policy: basePolicy,
      createdBy: "ops@latam.com",
      requestIp: null,
    });

    await waitForBlockedPolicyInsert();
    writer.release();
    await writer.done;

    const result = await attempt;
    expect(result.newPolicyVersion).toBe(3);

    const policies = await db.connection
      .selectFrom("namespace_policies")
      .select(["version"])
      .where("namespace_id", "=", namespaceId)
      .orderBy("version", "asc")
      .execute();
    expect(policies.map((row) => (row as { version: number }).version)).toEqual([1, 2, 3]);

    const auditRows = await db.connection
      .selectFrom("configuration_audit_log")
      .selectAll()
      .execute();
    expect(auditRows).toHaveLength(1);
  });
});
