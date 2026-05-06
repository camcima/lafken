import { Injectable } from "@nestjs/common";

import { AssetNotFoundError } from "@/assets/domain/errors/asset-not-found.error";
import { AssetNotInProcessingFailedStateError } from "@/assets/domain/errors/asset-not-in-processing-failed-state.error";
import { AssetProcessingRepositoryPort } from "@/assets/domain/repositories/asset-processing.repository.port";
import { AssetQueryRepositoryPort } from "@/assets/domain/repositories/asset-query.repository.port";

const RETRY_REQUESTED_REASON = "retry_requested";

export interface IRetryAssetProcessingInput {
  publicId: string;
  requestedByEmail: string;
}

@Injectable()
export class RetryAssetProcessingUseCase {
  constructor(
    private readonly assetQueryRepo: AssetQueryRepositoryPort,
    private readonly assetProcessingRepo: AssetProcessingRepositoryPort,
  ) {}

  async execute(input: IRetryAssetProcessingInput): Promise<void> {
    const asset = await this.assetQueryRepo.findByPublicId(input.publicId);
    if (!asset) {
      throw new AssetNotFoundError({ publicId: input.publicId });
    }

    if (asset.props.state !== "processing_failed") {
      throw new AssetNotInProcessingFailedStateError({
        publicId: input.publicId,
        currentState: asset.props.state,
      });
    }

    const restarted: boolean = await this.assetProcessingRepo.restartProcessing({
      assetId: asset.props.id,
      reason: RETRY_REQUESTED_REASON,
      requestedByEmail: input.requestedByEmail,
      now: new Date(),
    });

    // Race-loss: another caller flipped the row out of processing_failed
    // between our read and the conditional update. Surface the same domain
    // error as the read-time check — the caller's perspective is the same:
    // "the asset is no longer in processing_failed".
    if (!restarted) {
      throw new AssetNotInProcessingFailedStateError({
        publicId: input.publicId,
        currentState: asset.props.state,
      });
    }
  }
}
