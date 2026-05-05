import type { Asset } from "../entities/asset.entity";

export interface ICreateUploadedAssetInput {
  publicId: string;
  namespaceId: string;
  policyVersionId: string;
  storageBindingId: string;
  storageKey: string;
  declaredMimeType: string;
  declaredSizeBytes: bigint;
  uploadedBy: string | null;
  effectiveMaxSizeBytes: bigint;
  effectiveUrlTtl: number;
  intentId: string;
  width?: number | null;
  height?: number | null;
}

export abstract class AssetWriteRepositoryPort {
  /**
   * In one transaction:
   *   1. UPDATE upload_intents SET consumed_at = now() WHERE public_id = :publicId
   *      AND consumed_at IS NULL.
   *   2. INSERT INTO assets (...) RETURNING *.
   *   3. INSERT INTO asset_state_transitions (asset_id, from_state, to_state,
   *      reason, metadata, occurred_by) VALUES (..., NULL, 'uploaded',
   *      'upload_confirmed', '{"intent_id": :intentId}'::jsonb, :uploadedBy).
   *   4. INSERT INTO processing_jobs (asset_id, state, not_before, attempt_number)
   *      VALUES (:assetId, 'released', now(), 1).
   * Returns the new Asset (with DB-populated id / timestamps).
   */
  abstract createUploadedAsset(input: ICreateUploadedAssetInput): Promise<Asset>;
}
