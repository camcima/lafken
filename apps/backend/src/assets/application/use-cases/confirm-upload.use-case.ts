import { Injectable } from "@nestjs/common";

import type { Asset } from "@/assets/domain/entities/asset.entity";
import { UploadIntentExpiredError } from "@/assets/domain/errors/upload-intent-expired.error";
import { UploadIntentNotFoundError } from "@/assets/domain/errors/upload-intent-not-found.error";
import { UploadedObjectMissingError } from "@/assets/domain/errors/uploaded-object-missing.error";
import { AssetQueryRepositoryPort } from "@/assets/domain/repositories/asset-query.repository.port";
import { AssetWriteRepositoryPort } from "@/assets/domain/repositories/asset-write.repository.port";
import { UploadIntentWriteRepositoryPort } from "@/assets/domain/repositories/upload-intent-write.repository.port";
import { AssetStoragePort } from "@/assets/domain/services/asset-storage.service.port";
import { NamespaceQueryRepositoryPort } from "@/namespaces/domain/repositories/namespace-query.repository.port";
import { StorageBindingQueryRepositoryPort } from "@/system/domain/repositories/storage-binding-query.repository.port";

const DEFAULT_SIGNED_URL_TTL_SECONDS = 3600;

export interface IConfirmUploadInput {
  publicId: string;
  uploadedBy: string | null;
  width?: number;
  height?: number;
}

@Injectable()
export class ConfirmUploadUseCase {
  constructor(
    private readonly intentRepo: UploadIntentWriteRepositoryPort,
    private readonly assetWriteRepo: AssetWriteRepositoryPort,
    private readonly assetStorage: AssetStoragePort,
    private readonly namespaceQueryRepo: NamespaceQueryRepositoryPort,
    private readonly storageBindingQueryRepo: StorageBindingQueryRepositoryPort,
    private readonly assetQueryRepo: AssetQueryRepositoryPort,
  ) {}

  async execute(input: IConfirmUploadInput): Promise<Asset> {
    const intent = await this.intentRepo.findByPublicId(input.publicId);
    if (!intent) {
      throw new UploadIntentNotFoundError({ publicId: input.publicId });
    }

    if (intent.isConsumed()) {
      const existing = await this.assetQueryRepo.findByPublicId(input.publicId);
      if (!existing) {
        throw new Error(
          `Intent "${input.publicId}" is consumed but no asset exists — invariant violation.`,
        );
      }
      return existing;
    }

    const now = new Date();
    if (intent.isExpired(now)) {
      throw new UploadIntentExpiredError({
        publicId: input.publicId,
        expiredAt: intent.props.uploadUrlExpiresAt,
      });
    }

    const binding = await this.storageBindingQueryRepo.findById(intent.props.storageBindingId);
    if (!binding) {
      throw new Error(
        `Storage binding "${intent.props.storageBindingId}" missing for intent "${input.publicId}".`,
      );
    }

    const gcsConfig = binding.getGcsConfig();
    const exists = await this.assetStorage.objectExists({
      binding: { bucket: gcsConfig.bucket, projectId: gcsConfig.projectId },
      storageKey: intent.props.storageKey,
    });
    if (!exists) {
      throw new UploadedObjectMissingError({
        publicId: input.publicId,
        storageKey: intent.props.storageKey,
      });
    }

    const policy = await this.namespaceQueryRepo.findPolicyById(intent.props.policyVersionId);
    if (!policy) {
      throw new Error(
        `Policy version "${intent.props.policyVersionId}" missing for intent "${input.publicId}".`,
      );
    }

    return this.assetWriteRepo.createUploadedAsset({
      publicId: intent.props.publicId,
      namespaceId: intent.props.namespaceId,
      policyVersionId: intent.props.policyVersionId,
      storageBindingId: intent.props.storageBindingId,
      storageKey: intent.props.storageKey,
      declaredMimeType: intent.props.declaredMimeType,
      declaredSizeBytes: intent.props.declaredSizeBytes,
      uploadedBy: input.uploadedBy,
      effectiveMaxSizeBytes: policy.props.maxFileSizeBytes,
      effectiveUrlTtl: policy.props.signedUrlTtlSeconds ?? DEFAULT_SIGNED_URL_TTL_SECONDS,
      intentId: intent.props.id,
      width: input.width ?? null,
      height: input.height ?? null,
    });
  }
}
