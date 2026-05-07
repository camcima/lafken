import type { IAssetPublicIdResolution } from "@/assets/domain/repositories/asset-query.repository.port";

export class FakeAssetPublicIdResolver {
  /** Pre-seed publicId -> { id, namespaceSlug } pairs. */
  public records = new Map<string, { id: string; namespaceSlug: string }>();

  findInternalIdsAndNamespaceSlugsByPublicIds(
    publicIds: string[],
  ): Promise<IAssetPublicIdResolution[]> {
    const result = publicIds
      .map((publicId) => {
        const record = this.records.get(publicId);
        return record ? { id: record.id, publicId, namespaceSlug: record.namespaceSlug } : null;
      })
      .filter((item): item is IAssetPublicIdResolution => item !== null);
    return Promise.resolve(result);
  }
}
