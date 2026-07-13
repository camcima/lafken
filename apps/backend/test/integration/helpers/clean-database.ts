import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

/**
 * Wipes every table used by the integration suite, in strict
 * FK-dependency order (children before parents).
 *
 * The schema uses `ON DELETE RESTRICT` everywhere (never CASCADE), so
 * deleting a parent row while a child row still references it fails
 * with a FK-violation error. The order below was derived directly from
 * the FK constraints declared in `db/migrations/*.sql`:
 *
 * - `legal_hold_assets`      -> legal_holds, assets
 * - `processing_jobs`        -> assets
 * - `asset_analyses`         -> assets
 * - `asset_state_transitions`-> assets
 * - `legal_holds`            -> (no FK; must wait for legal_hold_assets)
 * - `assets`                 -> namespaces, namespace_policies, storage_bindings
 * - `upload_intents`         -> namespaces, namespace_policies, storage_bindings
 * - `namespace_presets`      -> namespaces
 * - `namespace_policies`     -> namespaces
 * - `namespaces`             -> storage_bindings (+ deferred FK to namespace_policies)
 * - `storage_bindings`       -> (no FK)
 * - `configuration_audit_log`-> (no FK; standalone)
 *
 * This is the SINGLE source of truth for integration-test cleanup.
 * Every spec's `beforeEach` should call this instead of hand-rolling
 * its own `deleteFrom` list — a hand-maintained list that misses a
 * table (or an FK added later) breaks a LATER spec whose cleanup runs
 * against leftover rows, since the suite runs sequentially against one
 * shared database (`fileParallelism: false`).
 */
export async function cleanDatabase(db: DatabaseClient): Promise<void> {
  await db.connection.transaction().execute(async (tx) => {
    await tx.deleteFrom("legal_hold_assets").execute();
    await tx.deleteFrom("processing_jobs").execute();
    await tx.deleteFrom("asset_analyses").execute();
    await tx.deleteFrom("asset_state_transitions").execute();
    await tx.deleteFrom("legal_holds").execute();
    await tx.deleteFrom("assets").execute();
    await tx.deleteFrom("upload_intents").execute();
    await tx.deleteFrom("namespace_presets").execute();
    await tx.deleteFrom("namespace_policies").execute();
    await tx.deleteFrom("namespaces").execute();
    await tx.deleteFrom("storage_bindings").execute();
    await tx.deleteFrom("configuration_audit_log").execute();
  });
}
