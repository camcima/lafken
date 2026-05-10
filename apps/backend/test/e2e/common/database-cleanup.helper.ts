import type { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

/**
 * Deletes every row from the asset/namespace/legal-hold table family in
 * foreign-key-safe order. Idempotent. Runs in a single transaction.
 *
 * Dependency order (children first, parents last):
 *   legal_hold_assets -> legal_holds
 *                     \-> asset_analyses
 *                      -> assets <- asset_state_transitions
 *                                <- processing_jobs
 *                                <- upload_intents
 *   namespaces        -> namespace_presets, namespace_policies
 *   storage_bindings  -> namespaces
 *   configuration_audit_log (no FK dependencies)
 */
export async function truncateAllAssetTables(db: DatabaseClient): Promise<void> {
  await db.connection.transaction().execute(async (tx) => {
    await tx.deleteFrom("legal_hold_assets").execute();
    await tx.deleteFrom("legal_holds").execute();
    await tx.deleteFrom("asset_analyses").execute();
    await tx.deleteFrom("asset_state_transitions").execute();
    await tx.deleteFrom("processing_jobs").execute();
    await tx.deleteFrom("assets").execute();
    await tx.deleteFrom("upload_intents").execute();
    await tx.deleteFrom("namespace_presets").execute();
    await tx.deleteFrom("namespace_policies").execute();
    await tx.deleteFrom("namespaces").execute();
    await tx.deleteFrom("storage_bindings").execute();
    await tx.deleteFrom("configuration_audit_log").execute();
  });
}
