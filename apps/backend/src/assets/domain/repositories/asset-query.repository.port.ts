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
  /**
   * Free-text search. Matches case-insensitive substrings against public_id,
   * external_ref_id, uploaded_by, the hex-encoded content_hash, and any
   * value in the `tags` array. Backed by pg_trgm GIN indexes (migration
   * 20260506223036) plus an unnest over the `tags` array.
   */
  q?: string;
  /**
   * Tag filter with AND semantics: an asset is included only if its `tags`
   * array contains every listed value (`tags @> ARRAY[...]`). Backed by the
   * GIN index on `tags` — see migration 20260507011101.
   */
  tags?: string[];
  /** Filter to only assets linked to this legal hold (by internal UUID). */
  legalHoldId?: string;
}

export interface IAssetPublicIdResolution {
  id: string;
  publicId: string;
  namespaceSlug: string;
}

export interface AssetPage {
  data: Asset[];
  total: number;
  page: number;
  limit: number;
  lastPage: number;
}

export interface NamespaceStorageUsage {
  totalBytes: bigint;
  assetCount: number;
}

export abstract class AssetQueryRepositoryPort {
  abstract list(input: ListAssetsInput): Promise<AssetPage>;
  abstract findById(id: string): Promise<Asset | null>;
  abstract findByPublicId(publicId: string): Promise<Asset | null>;
  abstract listStateTransitions(assetId: string): Promise<AssetStateTransition[]>;
  abstract listAnalyses(assetId: string): Promise<AssetAnalysis[]>;
  abstract findProcessingJob(assetId: string): Promise<ProcessingJob | null>;
  abstract findNamespaceSlug(namespaceId: string): Promise<string | null>;
  abstract findPolicyVersion(policyVersionId: string): Promise<number | null>;
  /**
   * Aggregate storage used by uploaded assets in a namespace. Excludes
   * pending intents (whose `size_bytes` is null) and any state where the
   * object is no longer counted toward usage (deleted, expired).
   */
  abstract getNamespaceStorageUsage(namespaceId: string): Promise<NamespaceStorageUsage>;
  /**
   * Resolve a list of public UUIDs to their internal IDs and namespace slugs.
   * Public IDs not found in the database are silently omitted from the result.
   */
  abstract findInternalIdsAndNamespaceSlugsByPublicIds(
    publicIds: string[],
  ): Promise<IAssetPublicIdResolution[]>;
}
