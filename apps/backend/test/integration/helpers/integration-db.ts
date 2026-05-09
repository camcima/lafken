import { afterAll, beforeAll } from "vitest";

import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

import { createTestDatabaseClient } from "./create-test-database-client";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

export interface IInsertIntentRawOptions {
  uploadUrlExpiresAt: Date;
  consumedAt?: Date;
  expiredAt?: Date;
}

export interface IIntentRow {
  id: string;
  public_id: string;
  namespace_id: string;
  policy_version_id: string;
  storage_binding_id: string;
  storage_key: string;
  declared_mime_type: string | null;
  declared_size_bytes: bigint | null;
  upload_url: string;
  upload_url_expires_at: Date;
  created_by: string | null;
  consumed_at: Date | null;
  expired_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface IIntentRawRef {
  publicId: string;
}

export interface IIntegrationDbContext {
  db: DatabaseClient;
  cleanCommonTables: () => Promise<void>;
  seedNamespaceWithPolicyAndBinding: () => Promise<{
    namespaceId: string;
    policyVersionId: string;
    bindingId: string;
  }>;
  insertIntentRaw: (options: IInsertIntentRawOptions) => Promise<IIntentRawRef>;
  fetchIntentRow: (publicId: string) => Promise<IIntentRow>;
}

export function setupIntegrationDb(): IIntegrationDbContext {
  let db: DatabaseClient;

  // IDs from the most recent seedNamespaceWithPolicyAndBinding call
  let _namespaceId: string = NIL_UUID;
  let _policyVersionId: string = NIL_UUID;
  let _bindingId: string = NIL_UUID;

  beforeAll(async () => {
    db = await createTestDatabaseClient();
  });

  afterAll(async () => {
    await db.closeConnection();
  });

  async function cleanCommonTables(): Promise<void> {
    await db.connection.transaction().execute(async (tx) => {
      await tx.deleteFrom("legal_hold_assets").execute();
      await tx.deleteFrom("asset_analyses").execute();
      await tx.deleteFrom("asset_state_transitions").execute();
      await tx.deleteFrom("processing_jobs").execute();
      await tx.deleteFrom("assets").execute();
      await tx.deleteFrom("upload_intents").execute();
      await tx.deleteFrom("namespace_presets").execute();
      await tx.deleteFrom("namespace_policies").execute();
      await tx.deleteFrom("namespaces").execute();
      await tx.deleteFrom("storage_bindings").execute();
    });
  }

  async function seedNamespaceWithPolicyAndBinding(): Promise<{
    namespaceId: string;
    policyVersionId: string;
    bindingId: string;
  }> {
    const sb = await db.connection
      .insertInto("storage_bindings")
      .values({ name: "test-binding", adapter_type: "gcs", config: { bucket: "lafken-dev" } })
      .returning("id")
      .executeTakeFirstOrThrow();
    _bindingId = (sb as { id: string }).id;

    const seeded = await db.connection.transaction().execute(async (tx) => {
      const ns = await tx
        .insertInto("namespaces")
        .values({
          slug: "aircraft-photos",
          display_name: "Aircraft Photos",
          description: null,
          current_policy_id: NIL_UUID,
          storage_binding_id: _bindingId,
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

    _namespaceId = seeded.namespaceId;
    _policyVersionId = seeded.policyVersionId;

    return { namespaceId: _namespaceId, policyVersionId: _policyVersionId, bindingId: _bindingId };
  }

  let _intentCounter = 0;

  async function insertIntentRaw(options: IInsertIntentRawOptions): Promise<IIntentRawRef> {
    _intentCounter++;
    const storageKey = `uploads/intent-${_intentCounter}.jpg`;

    const row = await db.connection
      .insertInto("upload_intents")
      .values({
        namespace_id: _namespaceId,
        policy_version_id: _policyVersionId,
        storage_binding_id: _bindingId,
        storage_key: storageKey,
        declared_mime_type: "image/jpeg",
        declared_size_bytes: 1024n,
        upload_url: "https://storage.example.com/signed",
        upload_url_expires_at: options.uploadUrlExpiresAt,
        created_by: null,
        consumed_at: options.consumedAt ?? null,
        expired_at: options.expiredAt ?? null,
      })
      .returning("public_id")
      .executeTakeFirstOrThrow();

    return { publicId: (row as { public_id: string }).public_id };
  }

  async function fetchIntentRow(publicId: string): Promise<IIntentRow> {
    const row = await db.connection
      .selectFrom("upload_intents")
      .selectAll()
      .where("public_id", "=", publicId)
      .executeTakeFirstOrThrow();
    return row as unknown as IIntentRow;
  }

  const ctx: IIntegrationDbContext = {
    get db() {
      return db;
    },
    cleanCommonTables,
    seedNamespaceWithPolicyAndBinding,
    insertIntentRaw,
    fetchIntentRow,
  };

  return ctx;
}
