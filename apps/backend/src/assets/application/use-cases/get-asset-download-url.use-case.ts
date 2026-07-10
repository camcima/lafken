import { Injectable } from "@nestjs/common";

import { AssetNotDownloadableError } from "@/assets/domain/errors/asset-not-downloadable.error";
import { AssetNotFoundError } from "@/assets/domain/errors/asset-not-found.error";
import { AssetQueryRepositoryPort } from "@/assets/domain/repositories/asset-query.repository.port";
import { AssetStoragePort } from "@/assets/domain/services/asset-storage.service.port";
import { isAssetDownloadable } from "@/assets/domain/value-objects/asset-state.value-object";
import { StorageBindingQueryRepositoryPort } from "@/system/domain/repositories/storage-binding-query.repository.port";

const DOWNLOAD_URL_TTL_SECONDS = 300;

export interface IGetAssetDownloadUrlInput {
  publicId: string;
}

export interface IGetAssetDownloadUrlResult {
  url: string;
  /**
   * Resolved namespace slug for the asset's namespace, or `null` if the
   * namespace row was deleted between the asset query and this lookup. Used by
   * the controller as a metric attribute and is allowed-list bounded.
   */
  namespaceSlug: string | null;
}

@Injectable()
export class GetAssetDownloadUrlUseCase {
  constructor(
    private readonly assetQueryRepository: AssetQueryRepositoryPort,
    private readonly storageBindingQueryRepository: StorageBindingQueryRepositoryPort,
    private readonly assetStorage: AssetStoragePort,
  ) {}

  async execute(input: IGetAssetDownloadUrlInput): Promise<IGetAssetDownloadUrlResult> {
    const asset = await this.assetQueryRepository.findByPublicId(input.publicId);
    if (!asset) {
      throw new AssetNotFoundError({ publicId: input.publicId });
    }

    // F-S1: quarantine moves the bytes to `_quarantined/<key>` and updates
    // `storage_key` in the same UPDATE, so signing `asset.props.storageKey`
    // without this gate would hand out working URLs to quarantined bytes.
    if (!isAssetDownloadable(asset.props.state)) {
      throw new AssetNotDownloadableError({
        publicId: input.publicId,
        currentState: asset.props.state,
      });
    }

    const binding = await this.storageBindingQueryRepository.findById(asset.props.storageBindingId);
    if (!binding) {
      throw new Error(
        `Storage binding "${asset.props.storageBindingId}" missing for asset "${input.publicId}".`,
      );
    }

    const gcsConfig = binding.getGcsConfig();
    const url = await this.assetStorage.signReadUrl({
      binding: { bucket: gcsConfig.bucket, projectId: gcsConfig.projectId },
      storageKey: asset.props.storageKey,
      ttlSeconds: DOWNLOAD_URL_TTL_SECONDS,
    });

    const namespaceSlug = await this.assetQueryRepository.findNamespaceSlug(
      asset.props.namespaceId,
    );

    return { url, namespaceSlug };
  }
}
