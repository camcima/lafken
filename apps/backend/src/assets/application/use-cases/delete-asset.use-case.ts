import { Injectable } from "@nestjs/common";

import { AssetNotFoundError } from "@/assets/domain/errors/asset-not-found.error";
import { AssetUnderLegalHoldError } from "@/assets/domain/errors/asset-under-legal-hold.error";
import { AssetProcessingRepositoryPort } from "@/assets/domain/repositories/asset-processing.repository.port";
import { AssetQueryRepositoryPort } from "@/assets/domain/repositories/asset-query.repository.port";

const ASSET_DELETED_REASON = "asset_deleted";
const DELETED_STATE = "deleted" as const;

export interface IDeleteAssetInput {
  publicId: string;
  requestedByEmail: string;
}

@Injectable()
export class DeleteAssetUseCase {
  constructor(
    private readonly assetQueryRepo: AssetQueryRepositoryPort,
    private readonly assetProcessingRepo: AssetProcessingRepositoryPort,
  ) {}

  async execute(input: IDeleteAssetInput): Promise<void> {
    const asset = await this.assetQueryRepo.findByPublicId(input.publicId);
    if (!asset) {
      throw new AssetNotFoundError({ publicId: input.publicId });
    }

    if (asset.props.legalHold) {
      throw new AssetUnderLegalHoldError({ publicId: input.publicId, operation: "deleted" });
    }

    // Idempotent: deleting an already-deleted asset is a no-op. Avoids a
    // doomed transition attempt and lets clients retry safely.
    if (asset.props.state === DELETED_STATE) {
      return;
    }

    const transitioned: boolean = await this.assetProcessingRepo.transitionAsset({
      assetId: asset.props.id,
      fromState: asset.props.state,
      toState: DELETED_STATE,
      reason: ASSET_DELETED_REASON,
      metadata: { requested_by: input.requestedByEmail },
      occurredBy: input.requestedByEmail,
      now: new Date(),
    });

    // Race-loss: another caller transitioned the asset between our read and
    // the conditional update. Re-read and either succeed (now deleted) or
    // surface the not-found behavior the user would otherwise expect.
    if (!transitioned) {
      const refreshed = await this.assetQueryRepo.findByPublicId(input.publicId);
      if (!refreshed || refreshed.props.state === DELETED_STATE) {
        return;
      }
      throw new AssetNotFoundError({ publicId: input.publicId });
    }
  }
}
