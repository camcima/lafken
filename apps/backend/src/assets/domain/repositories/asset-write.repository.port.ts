import type { Asset } from "../entities/asset.entity";
import type { AssetState } from "../value-objects/asset-state.value-object";

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
  externalRefType?: string | null;
  externalRefId?: string | null;
  customMetadata?: Record<string, unknown>;
  tags?: string[];
  /**
   * Initial state for the new asset. Defaults to 'uploaded' for the happy
   * path. May be set to a quarantine state (e.g. 'quarantined_invalid_format')
   * when an inline check at confirm time decides the bytes shouldn't be
   * served until reviewed.
   */
  initialState?: AssetState;
  /** Free-text reason persisted on the asset (visible in audit + UI). */
  initialStateReason?: string;
  /**
   * Optional analysis row to write inside the same transaction. Used so the
   * audit/triage trail reflects exactly why an asset landed in its initial
   * state without a follow-up write.
   */
  initialAnalysis?: {
    analyzer: string;
    analyzerVersion: string;
    findings: Record<string, unknown>;
    decision: string;
  };
}

export interface ITransitionStateInput {
  publicId: string;
  toState: AssetState;
  /** Persisted on the asset and on the new state-transition row. */
  reason: string;
  /** Authenticated actor (user id / email) attributed in the audit row. */
  by: string | null;
  /**
   * Optional structured payload tucked under `asset_state_transitions.metadata`
   * — typical use: `{ note: "<reviewer note>" }` for release/reject decisions.
   */
  metadata?: Record<string, unknown>;
  /**
   * When provided, also rewrites `assets.storage_key` in the same UPDATE.
   * Used by the release flow to relocate bytes back from the `_quarantined/`
   * path to the original key.
   */
  newStorageKey?: string;
  /**
   * Optional CAS guard. When set, the UPDATE carries `AND state = :expectedFromState`;
   * if the asset was concurrently moved to another state, no row is updated,
   * no transition row is written, and the method returns null. Callers
   * distinguish "not found" from "lost the race" by re-reading the asset.
   */
  expectedFromState?: AssetState;
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

  /**
   * Atomically transitions an asset to a new state and writes a matching
   * `asset_state_transitions` row. The asset's `state`, `state_reason`, and
   * `state_changed_at` are updated in the same transaction. Returns the
   * post-transition Asset, or `null` when no asset exists with that
   * `publicId` (callers can map this to a 404) — or, when `expectedFromState`
   * is provided, when the asset's current state no longer matches (lost CAS).
   */
  abstract transitionState(input: ITransitionStateInput): Promise<Asset | null>;
}
