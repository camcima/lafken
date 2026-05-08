import type { AssetAnalysis } from "@/assets/domain/entities/asset-analysis.entity";
import type { AssetStateTransition } from "@/assets/domain/entities/asset-state-transition.entity";
import type { Asset } from "@/assets/domain/entities/asset.entity";
import type { ProcessingJob } from "@/assets/domain/entities/processing-job.entity";
import {
  AssetPage,
  AssetQueryRepositoryPort,
  IAssetPublicIdResolution,
  ListAssetsInput,
  NamespaceStorageUsage,
} from "@/assets/domain/repositories/asset-query.repository.port";

export class InMemoryAssetQueryRepository implements AssetQueryRepositoryPort {
  private assets: Asset[] = [];
  private stateTransitions = new Map<string, AssetStateTransition[]>();
  private analyses = new Map<string, AssetAnalysis[]>();
  private processingJobs = new Map<string, ProcessingJob>();
  private namespaceSlugs = new Map<string, string>();
  private policyVersions = new Map<string, number>();
  private legalHoldAssetMap = new Map<string, Set<string>>();

  seed(assets: Asset[]): void {
    this.assets = assets;
  }

  linkAssetToHold(assetPublicId: string, legalHoldId: string): void {
    const existing = this.legalHoldAssetMap.get(legalHoldId) ?? new Set<string>();
    existing.add(assetPublicId);
    this.legalHoldAssetMap.set(legalHoldId, existing);
  }

  seedStateTransitions(assetId: string, transitions: AssetStateTransition[]): void {
    this.stateTransitions.set(assetId, transitions);
  }

  seedAnalyses(assetId: string, analyses: AssetAnalysis[]): void {
    this.analyses.set(assetId, analyses);
  }

  seedProcessingJob(assetId: string, job: ProcessingJob): void {
    this.processingJobs.set(assetId, job);
  }

  seedNamespaceSlug(namespaceId: string, slug: string): void {
    this.namespaceSlugs.set(namespaceId, slug);
  }

  seedPolicyVersion(policyVersionId: string, version: number): void {
    this.policyVersions.set(policyVersionId, version);
  }

  list(input: ListAssetsInput): Promise<AssetPage> {
    const trimmedQ: string = input.q?.trim() ?? "";
    const qFiltered: Asset[] =
      trimmedQ.length === 0
        ? this.assets
        : this.assets.filter((a) => {
            const needle: string = trimmedQ.toLowerCase();
            const hashHex: string = a.props.contentHash?.toString("hex") ?? "";
            return (
              a.props.publicId.toLowerCase().includes(needle) ||
              (a.props.externalRefId?.toLowerCase().includes(needle) ?? false) ||
              (a.props.uploadedBy?.toLowerCase().includes(needle) ?? false) ||
              hashHex.toLowerCase().includes(needle)
            );
          });
    const legalHoldSet: Set<string> | null =
      input.legalHoldId !== null && input.legalHoldId !== undefined
        ? (this.legalHoldAssetMap.get(input.legalHoldId) ?? new Set<string>())
        : null;
    const filtered: Asset[] =
      legalHoldSet === null
        ? qFiltered
        : qFiltered.filter((a) => legalHoldSet.has(a.props.publicId));
    const total = filtered.length;
    const start = (input.page - 1) * input.limit;
    return Promise.resolve({
      data: filtered.slice(start, start + input.limit),
      total,
      page: input.page,
      limit: input.limit,
      lastPage: Math.max(1, Math.ceil(total / input.limit)),
    });
  }

  findById(id: string): Promise<Asset | null> {
    return Promise.resolve(this.assets.find((a) => a.props.id === id) ?? null);
  }

  findByPublicId(publicId: string): Promise<Asset | null> {
    return Promise.resolve(this.assets.find((a) => a.props.publicId === publicId) ?? null);
  }

  listStateTransitions(assetId: string): Promise<AssetStateTransition[]> {
    return Promise.resolve(this.stateTransitions.get(assetId) ?? []);
  }

  listAnalyses(assetId: string): Promise<AssetAnalysis[]> {
    return Promise.resolve(this.analyses.get(assetId) ?? []);
  }

  findProcessingJob(assetId: string): Promise<ProcessingJob | null> {
    return Promise.resolve(this.processingJobs.get(assetId) ?? null);
  }

  findNamespaceSlug(namespaceId: string): Promise<string | null> {
    return Promise.resolve(this.namespaceSlugs.get(namespaceId) ?? null);
  }

  findPolicyVersion(policyVersionId: string): Promise<number | null> {
    return Promise.resolve(this.policyVersions.get(policyVersionId) ?? null);
  }

  getNamespaceStorageUsage(namespaceId: string): Promise<NamespaceStorageUsage> {
    const EXCLUDED_STATES = new Set(["expired", "deleted"] as const);
    const ZERO_BYTES = 0n;
    const ZERO_COUNT = 0;
    const ONE = 1;
    let totalBytes = ZERO_BYTES;
    let assetCount = ZERO_COUNT;
    for (const asset of this.assets) {
      if (asset.props.namespaceId !== namespaceId) continue;
      if (asset.props.sizeBytes === null || asset.props.sizeBytes === undefined) continue;
      if (EXCLUDED_STATES.has(asset.props.state as "expired" | "deleted")) continue;
      totalBytes += BigInt(asset.props.sizeBytes);
      assetCount += ONE;
    }
    return Promise.resolve({ totalBytes, assetCount });
  }

  findInternalIdsAndNamespaceSlugsByPublicIds(
    publicIds: string[],
  ): Promise<IAssetPublicIdResolution[]> {
    if (publicIds.length === 0) return Promise.resolve([]);
    const publicIdSet = new Set(publicIds);
    const results: IAssetPublicIdResolution[] = [];
    for (const asset of this.assets) {
      if (!publicIdSet.has(asset.props.publicId)) continue;
      const namespaceSlug = this.namespaceSlugs.get(asset.props.namespaceId) ?? "";
      results.push({
        id: asset.props.id,
        publicId: asset.props.publicId,
        namespaceSlug,
      });
    }
    return Promise.resolve(results);
  }
}
