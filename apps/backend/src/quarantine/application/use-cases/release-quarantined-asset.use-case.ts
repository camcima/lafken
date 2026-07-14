import { Injectable } from "@nestjs/common";

import type { Asset } from "@/assets/domain/entities/asset.entity";
import { AssetNotFoundError } from "@/assets/domain/errors/asset-not-found.error";
import { AssetNotInQuarantineError } from "@/assets/domain/errors/asset-not-in-quarantine.error";
import { AssetUnderLegalHoldError } from "@/assets/domain/errors/asset-under-legal-hold.error";
import { AssetQueryRepositoryPort } from "@/assets/domain/repositories/asset-query.repository.port";
import { AssetWriteRepositoryPort } from "@/assets/domain/repositories/asset-write.repository.port";
import { AssetStoragePort } from "@/assets/domain/services/asset-storage.service.port";
import {
  type AssetState,
  fromQuarantinedStorageKey,
  QUARANTINE_KEY_PREFIX,
} from "@/assets/domain/value-objects/asset-state.value-object";
import { AuditWriteRepositoryPort } from "@/audit/domain/repositories/audit-write.repository.port";
import { UnitOfWorkPort } from "@/shared/application/unit-of-work.port";
import { StorageBindingQueryRepositoryPort } from "@/system/domain/repositories/storage-binding-query.repository.port";

const AUDIT_FALLBACK_PRINCIPAL = "system";

export interface IReleaseQuarantinedAssetInput {
  publicId: string;
  reviewerId: string | null;
  note?: string;
  requestIp: string | null;
}

@Injectable()
export class ReleaseQuarantinedAssetUseCase {
  constructor(
    private readonly assetQueryRepo: AssetQueryRepositoryPort,
    private readonly assetWriteRepo: AssetWriteRepositoryPort,
    private readonly assetStorage: AssetStoragePort,
    private readonly storageBindingRepo: StorageBindingQueryRepositoryPort,
    private readonly auditWriteRepo: AuditWriteRepositoryPort,
    private readonly unitOfWork: UnitOfWorkPort,
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

    const expectedFromState: AssetState = asset.props.state;

    // Transition + audit write happen inside one unit of work: a committed
    // release with no audit row (or an audit row with no committed release)
    // would violate the audit-trail guarantee (F-A9). The byte move above
    // stays outside the transaction as before — the known move/CAS
    // compensation gap (F-D4) is unrelated to the audit write and this
    // change must not widen it.
    const updated: Asset | null = await this.unitOfWork.execute(async (): Promise<Asset | null> => {
      const transitioned = await this.assetWriteRepo.transitionState({
        publicId: input.publicId,
        toState: "ready",
        reason,
        by: input.reviewerId,
        metadata: input.note ? { note: input.note, decision: "release" } : { decision: "release" },
        newStorageKey,
        expectedFromState,
      });
      if (!transitioned) {
        return null;
      }

      await this.auditWriteRepo.record({
        entityType: "asset",
        entityId: transitioned.props.publicId,
        action: "release",
        occurredBy: input.reviewerId ?? AUDIT_FALLBACK_PRINCIPAL,
        requestIp: input.requestIp,
        beforeState: { state: expectedFromState },
        afterState: { state: transitioned.props.state, storageKey: transitioned.props.storageKey },
        reason,
      });

      return transitioned;
    });

    if (!updated) {
      // Not found, or a concurrent reviewer transitioned the asset first
      // (lost CAS). Re-read to report the truth.
      const current = await this.assetQueryRepo.findByPublicId(input.publicId);
      if (!current) {
        throw new AssetNotFoundError({ publicId: input.publicId });
      }
      throw new AssetNotInQuarantineError({
        publicId: input.publicId,
        currentState: current.props.state,
      });
    }
    return updated;
  }
}
