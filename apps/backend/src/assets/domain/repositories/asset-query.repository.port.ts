import type { AssetAnalysis } from "../entities/asset-analysis.entity";
import type { AssetStateTransition } from "../entities/asset-state-transition.entity";
import type { Asset } from "../entities/asset.entity";
import type { ProcessingJob } from "../entities/processing-job.entity";
import type { AssetState } from "../value-objects/asset-state.value-object";

export interface ListAssetsInput {
  page: number;
  limit: number;
  namespaceSlug?: string;
  states?: AssetState[];
  uploadedBy?: string;
  owningRecordType?: string;
  owningRecordId?: string;
  uploadedFrom?: string;
  uploadedTo?: string;
}

export interface AssetPage {
  data: Asset[];
  total: number;
  page: number;
  limit: number;
  lastPage: number;
}

export abstract class AssetQueryRepositoryPort {
  abstract list(input: ListAssetsInput): Promise<AssetPage>;
  abstract findByPublicId(publicId: string): Promise<Asset | null>;
  abstract listStateTransitions(assetId: bigint): Promise<AssetStateTransition[]>;
  abstract listAnalyses(assetId: bigint): Promise<AssetAnalysis[]>;
  abstract findProcessingJob(assetId: bigint): Promise<ProcessingJob | null>;
  abstract findNamespaceSlug(namespaceId: bigint): Promise<string | null>;
  abstract findPolicyVersion(policyVersionId: bigint): Promise<number | null>;
}
