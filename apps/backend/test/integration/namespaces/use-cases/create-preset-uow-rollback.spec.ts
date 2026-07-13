import { AsyncLocalStorage } from "node:async_hooks";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { AuditWriteRepository } from "@/audit/infrastructure/persistence/repositories/audit-write.repository";
import { CreatePresetUseCase } from "@/namespaces/application/use-cases/create-preset.use-case";
import { PresetParams } from "@/namespaces/domain/value-objects/preset-params.value-object";
import { NamespacePresetWriteRepository } from "@/namespaces/infrastructure/persistence/repositories/namespace-preset-write.repository";
import { NamespaceQueryRepository } from "@/namespaces/infrastructure/persistence/repositories/namespace-query.repository";
import { ConnectionResolver } from "@/shared/infrastructure/persistence/connection-resolver";
import { DatabaseAsyncLocalStorage } from "@/shared/infrastructure/persistence/database-async-local-storage";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";
import { DatabaseUnitOfWork } from "@/shared/infrastructure/persistence/database-unit-of-work";

import { cleanDatabase } from "../../helpers/clean-database";
import { createTestDatabaseClient } from "../../helpers/create-test-database-client";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

const VALID_PARAMS = PresetParams.fromUnknown({
  width: 800,
  height: 600,
  fit: "cover",
  format: "webp",
  quality: 80,
  dpr: 2,
});

describe("[Integration] CreatePresetUseCase — UoW rollback (F-D2)", () => {
  let db: DatabaseClient;
  let useCase: CreatePresetUseCase;

  beforeAll(async () => {
    db = await createTestDatabaseClient();
    const als = new DatabaseAsyncLocalStorage(new AsyncLocalStorage());
    const resolver = new ConnectionResolver(db, als);
    const unitOfWork = new DatabaseUnitOfWork(als, db);
    useCase = new CreatePresetUseCase(
      new NamespaceQueryRepository(db, resolver),
      new NamespacePresetWriteRepository(db, resolver),
      new AuditWriteRepository(resolver),
      unitOfWork,
    );
  });

  afterAll(async () => {
    await db.closeConnection();
  });

  beforeEach(async () => {
    await cleanDatabase(db);

    const sb = await db.connection
      .insertInto("storage_bindings")
      .values({ name: "test-binding", adapter_type: "gcs", config: { bucket: "lafken-dev" } })
      .returning("id")
      .executeTakeFirstOrThrow();
    const bindingId = (sb as { id: string }).id;

    await db.connection.transaction().execute(async (tx) => {
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
          retention_mode: "none",
          max_file_size_bytes: 52_428_800n,
          allowed_mime_types: ["image/jpeg"],
          exif_handling: "strip",
          virus_scan_required: false,
          immutable: false,
          serving_mode: "signed",
          signed_url_ttl_seconds: 3600,
          signed_url_bucket_size: 300,
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      await tx
        .updateTable("namespaces")
        .set({ current_policy_id: (policy as { id: string }).id })
        .where("id", "=", nsId)
        .execute();
    });
  });

  it("rolls back the preset insert when the audit-log write fails (real inet constraint failure)", async () => {
    // request_ip is a Postgres `inet` column: an unparseable value makes the
    // audit INSERT fail for real (22P02) inside the UoW — no mocking of the
    // repository under test.
    await expect(
      useCase.execute({
        slug: "aircraft-photos",
        name: "thumbnail",
        params: VALID_PARAMS,
        createdBy: "ops@latam.com",
        requestIp: "not-an-ip",
      }),
    ).rejects.toThrow();

    const presets = await db.connection.selectFrom("namespace_presets").selectAll().execute();
    expect(presets).toHaveLength(0);

    const auditRows = await db.connection
      .selectFrom("configuration_audit_log")
      .selectAll()
      .execute();
    expect(auditRows).toHaveLength(0);
  });

  it("commits preset and audit row together on the happy path", async () => {
    const preset = await useCase.execute({
      slug: "aircraft-photos",
      name: "thumbnail",
      params: VALID_PARAMS,
      createdBy: "ops@latam.com",
      requestIp: "203.0.113.7",
    });

    expect(preset.props.version).toBe(1);

    const presets = await db.connection.selectFrom("namespace_presets").selectAll().execute();
    expect(presets).toHaveLength(1);

    const auditRows = await db.connection
      .selectFrom("configuration_audit_log")
      .selectAll()
      .execute();
    expect(auditRows).toHaveLength(1);
    expect((auditRows[0] as { entity_type: string }).entity_type).toBe("namespace_preset");
    expect((auditRows[0] as { action: string }).action).toBe("create");
  });
});
