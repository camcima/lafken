import { Injectable } from "@nestjs/common";

import type { Asset } from "@/assets/domain/entities/asset.entity";
import { AssetNotFoundError } from "@/assets/domain/errors/asset-not-found.error";
import { AssetNotInQuarantineError } from "@/assets/domain/errors/asset-not-in-quarantine.error";
import { AssetUnderLegalHoldError } from "@/assets/domain/errors/asset-under-legal-hold.error";
import { AssetQueryRepositoryPort } from "@/assets/domain/repositories/asset-query.repository.port";
import { AssetWriteRepositoryPort } from "@/assets/domain/repositories/asset-write.repository.port";
import { AssetStoragePort } from "@/assets/domain/services/asset-storage.service.port";
import {
  fromQuarantinedStorageKey,
  QUARANTINE_KEY_PREFIX,
} from "@/assets/domain/value-objects/asset-state.value-object";
import { StorageBindingQueryRepositoryPort } from "@/system/domain/repositories/storage-binding-query.repository.port";

export interface IReleaseQuarantinedAssetInput {
  publicId: string;
  reviewerId: string | null;
  note?: string;
}

@Injectable()
export class ReleaseQuarantinedAssetUseCase {
  constructor(
    private readonly assetQueryRepo: AssetQueryRepositoryPort,
    private readonly assetWriteRepo: AssetWriteRepositoryPort,
    private readonly assetStorage: AssetStoragePort,
    private readonly storageBindingRepo: StorageBindingQueryRepositoryPort,
  ) {}

  async execute(input: IReleaseQuarantinedAssetInput): Promise<Asset> {
    const asset = await this.assetQueryRepo.findByPublicId(input.publicId);
    if (!asset) {
      throw new AssetNotFoundError({ publicId: input.publicId });
    }

    if (!asset.props.state.startsWith("quarantined_")) {
      throw new AssetNotInQuarantineError({
        publicId: input.publicId,
        currentState: asset.props.state,
      });
    }

    if (asset.props.legalHold) {
      throw new AssetUnderLegalHoldError({
        publicId: input.publicId,
        operation: "released",
      });
    }

    const reason: string = input.note?.trim()
      ? `released_from_quarantine: ${input.note.trim()}`
      : "released_from_quarantine";

    // Move bytes back to the original key so the asset is servable again.
    // Pre-existing assets quarantined before the move-on-quarantine wiring
    // landed have a key that doesn't carry the prefix — in that case there's
    // nothing to move and we just transition.
    let newStorageKey: string | undefined;
    if (asset.props.storageKey.startsWith(QUARANTINE_KEY_PREFIX)) {
      const binding = await this.storageBindingRepo.findById(asset.props.storageBindingId);
      if (!binding) {
        throw new Error(
          `Storage binding "${asset.props.storageBindingId}" missing for asset "${input.publicId}".`,
        );
      }
      const gcs = binding.getGcsConfig();
      newStorageKey = fromQuarantinedStorageKey(asset.props.storageKey);
      await this.assetStorage.moveObject({
        binding: { bucket: gcs.bucket, projectId: gcs.projectId },
        fromKey: asset.props.storageKey,
        toKey: newStorageKey,
      });
    }

    const updated = await this.assetWriteRepo.transitionState({
      publicId: input.publicId,
      toState: "ready",
      reason,
      by: input.reviewerId,
      metadata: input.note ? { note: input.note, decision: "release" } : { decision: "release" },
      newStorageKey,
    });

    if (!updated) {
      throw new AssetNotFoundError({ publicId: input.publicId });
    }
    return updated;
  }
}
