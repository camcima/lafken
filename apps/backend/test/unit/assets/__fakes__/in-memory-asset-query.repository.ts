import type { AssetAnalysis } from "@/assets/domain/entities/asset-analysis.entity";
import type { AssetStateTransition } from "@/assets/domain/entities/asset-state-transition.entity";
import type { Asset } from "@/assets/domain/entities/asset.entity";
import type { ProcessingJob } from "@/assets/domain/entities/processing-job.entity";
import {
  AssetPage,
  AssetQueryRepositoryPort,
  ListAssetsInput,
} from "@/assets/domain/repositories/asset-query.repository.port";

export class InMemoryAssetQueryRepository implements AssetQueryRepositoryPort {
  private assets: Asset[] = [];
  private stateTransitions = new Map<bigint, AssetStateTransition[]>();
  private analyses = new Map<bigint, AssetAnalysis[]>();
  private processingJobs = new Map<bigint, ProcessingJob>();
  private namespaceSlugs = new Map<bigint, string>();
  private policyVersions = new Map<bigint, number>();

  seed(assets: Asset[]): void {
    this.assets = assets;
  }

  seedStateTransitions(assetId: bigint, transitions: AssetStateTransition[]): void {
    this.stateTransitions.set(assetId, transitions);
  }

  seedAnalyses(assetId: bigint, analyses: AssetAnalysis[]): void {
    this.analyses.set(assetId, analyses);
  }

  seedProcessingJob(assetId: bigint, job: ProcessingJob): void {
    this.processingJobs.set(assetId, job);
  }

  seedNamespaceSlug(namespaceId: bigint, slug: string): void {
    this.namespaceSlugs.set(namespaceId, slug);
  }

  seedPolicyVersion(policyVersionId: bigint, version: number): void {
    this.policyVersions.set(policyVersionId, version);
  }

  list(input: ListAssetsInput): Promise<AssetPage> {
    const total = this.assets.length;
    const start = (input.page - 1) * input.limit;
    return Promise.resolve({
      data: this.assets.slice(start, start + input.limit),
      total,
      page: input.page,
      limit: input.limit,
      lastPage: Math.max(1, Math.ceil(total / input.limit)),
    });
  }

  findByPublicId(publicId: string): Promise<Asset | null> {
    return Promise.resolve(this.assets.find((a) => a.props.publicId === publicId) ?? null);
  }

  listStateTransitions(assetId: bigint): Promise<AssetStateTransition[]> {
    return Promise.resolve(this.stateTransitions.get(assetId) ?? []);
  }

  listAnalyses(assetId: bigint): Promise<AssetAnalysis[]> {
    return Promise.resolve(this.analyses.get(assetId) ?? []);
  }

  findProcessingJob(assetId: bigint): Promise<ProcessingJob | null> {
    return Promise.resolve(this.processingJobs.get(assetId) ?? null);
  }

  findNamespaceSlug(namespaceId: bigint): Promise<string | null> {
    return Promise.resolve(this.namespaceSlugs.get(namespaceId) ?? null);
  }

  findPolicyVersion(policyVersionId: bigint): Promise<number | null> {
    return Promise.resolve(this.policyVersions.get(policyVersionId) ?? null);
  }
}
