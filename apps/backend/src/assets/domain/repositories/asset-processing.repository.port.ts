import type { Asset } from "@/assets/domain/entities/asset.entity";
import type { AssetState } from "@/assets/domain/value-objects/asset-state.value-object";
import type { NamespacePolicy } from "@/namespaces/domain/entities/namespace-policy.entity";

export interface IAssetWithPolicy {
  asset: Asset;
  policy: NamespacePolicy;
}

export interface ITransitionAssetInput {
  assetId: string;
  fromState: AssetState;
  toState: AssetState;
  reason: string;
  metadata: Record<string, unknown>;
  occurredBy: string;
  now: Date;
}

export interface IRecordAnalysisInput {
  assetId: string;
  analyzer: string;
  analyzerVersion: string | null;
  findings: Record<string, unknown>;
  decision: "pass" | "flag" | "quarantine" | "error";
  occurredAt: Date;
}

export interface IUpdateDerivedMetadataInput {
  assetId: string;
  mimeType: string;
  sizeBytes: bigint;
  width: number | null;
  height: number | null;
  contentHash: Buffer;
  captureContext: Record<string, unknown> | null;
}

export interface IRestartProcessingInput {
  assetId: string;
  reason: string;
  requestedByEmail: string;
  now: Date;
}

export abstract class AssetProcessingRepositoryPort {
  abstract findAssetWithPolicy(assetId: string): Promise<IAssetWithPolicy | null>;
  abstract transitionAsset(input: ITransitionAssetInput): Promise<boolean>;
  abstract recordAnalysis(input: IRecordAnalysisInput): Promise<void>;
  abstract updateDerivedMetadata(input: IUpdateDerivedMetadataInput): Promise<void>;
  /**
   * Atomically transitions an asset from `processing_failed` back to `uploaded`
   * and re-primes the existing `processing_jobs` row (or inserts a fresh one if
   * absent) so the worker can pick the asset up again on its next tick.
   *
   * Returns `true` when the transition fired (precondition `state =
   * 'processing_failed'` matched), `false` if it lost a race — caller decides
   * how to handle the false case.
   */
  abstract restartProcessing(input: IRestartProcessingInput): Promise<boolean>;
}
