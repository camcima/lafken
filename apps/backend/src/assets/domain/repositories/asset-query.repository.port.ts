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
  externalRefType?: string;
  externalRefId?: string;
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
  abstract listStateTransitions(assetId: string): Promise<AssetStateTransition[]>;
  abstract listAnalyses(assetId: string): Promise<AssetAnalysis[]>;
  abstract findProcessingJob(assetId: string): Promise<ProcessingJob | null>;
  abstract findNamespaceSlug(namespaceId: string): Promise<string | null>;
  abstract findPolicyVersion(policyVersionId: string): Promise<number | null>;
}
