import { Injectable } from "@nestjs/common";

import { AssetNotFoundError } from "@/assets/domain/errors/asset-not-found.error";
import { AssetQueryRepositoryPort } from "@/assets/domain/repositories/asset-query.repository.port";
import { AssetStoragePort } from "@/assets/domain/services/asset-storage.service.port";
import { StorageBindingQueryRepositoryPort } from "@/system/domain/repositories/storage-binding-query.repository.port";

const DOWNLOAD_URL_TTL_SECONDS = 300;

export interface IGetAssetDownloadUrlInput {
  publicId: string;
}

export interface IGetAssetDownloadUrlResult {
  url: string;
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

    return { url };
  }
}
