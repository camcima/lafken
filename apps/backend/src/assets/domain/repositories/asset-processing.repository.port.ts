import type { Asset } from "@/assets/domain/entities/asset.entity";
import type { AssetState } from "@/assets/domain/value-objects/asset-state.value-object";
import type { NamespacePolicy } from "@/namespaces/domain/entities/namespace-policy.entity";

export interface IAssetWithPolicy {
  asset: Asset;
  policy: NamespacePolicy;
}

export interface ITransitionAssetInput {
  assetId: string;
  expectedState: AssetState;
  nextState: AssetState;
  reason: string;
  metadata: Record<string, unknown>;
  occurredBy: string;
  occurredAt: Date;
}

export interface IRecordAnalysisInput {
  assetId: string;
  analyzer: string;
  analyzerVersion: string | null;
  findings: Record<string, unknown>;
  decision: string | null;
  occurredAt: Date;
}

export interface IUpdateDerivedMetadataInput {
  assetId: string;
  mimeType: string;
  sizeBytes: bigint;
  width: number;
  height: number;
  contentHash: Buffer;
  captureContext: Record<string, unknown>;
}

export abstract class AssetProcessingRepositoryPort {
  abstract findAssetWithPolicy(assetId: string): Promise<IAssetWithPolicy | null>;
  abstract transitionAsset(input: ITransitionAssetInput): Promise<Asset | null>;
  abstract recordAnalysis(input: IRecordAnalysisInput): Promise<void>;
  abstract updateDerivedMetadata(input: IUpdateDerivedMetadataInput): Promise<Asset | null>;
}
