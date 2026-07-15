import { Injectable } from "@nestjs/common";

import { AssetNotFoundError } from "@/assets/domain/errors/asset-not-found.error";
import { AssetUnderLegalHoldError } from "@/assets/domain/errors/asset-under-legal-hold.error";
import { AssetProcessingRepositoryPort } from "@/assets/domain/repositories/asset-processing.repository.port";
import { AssetQueryRepositoryPort } from "@/assets/domain/repositories/asset-query.repository.port";
import { ProcessingJobRepositoryPort } from "@/assets/domain/repositories/processing-job.repository.port";

const ASSET_DELETED_REASON = "asset_deleted";
const DELETED_STATE = "deleted" as const;

export interface IDeleteAssetInput {
  id: string;
  requestedByEmail: string;
}

@Injectable()
export class DeleteAssetUseCase {
  constructor(
    private readonly assetQueryRepo: AssetQueryRepositoryPort,
    private readonly assetProcessingRepo: AssetProcessingRepositoryPort,
    private readonly processingJobRepo: ProcessingJobRepositoryPort,
  ) {}

  async execute(input: IDeleteAssetInput): Promise<void> {
    const asset = await this.assetQueryRepo.findById(input.id);
    if (!asset) {
      throw new AssetNotFoundError({ publicId: input.id });
    }

    if (asset.props.legalHold) {
      throw new AssetUnderLegalHoldError({ publicId: asset.props.publicId, operation: "deleted" });
    }

    // Idempotent: deleting an already-deleted asset is a no-op transition,
    // but still sweep any leftover job row (F-P1) so retries can't fire.
    if (asset.props.state === DELETED_STATE) {
      await this.cancelPendingJob(asset.props.id);
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
      const refreshed = await this.assetQueryRepo.findById(input.id);
      if (!refreshed || refreshed.props.state === DELETED_STATE) {
        if (refreshed) {
          await this.cancelPendingJob(refreshed.props.id);
        }
        return;
      }
      throw new AssetNotFoundError({ publicId: input.id });
    }

    // F-P1: a released job with pending backoff must not survive the delete —
    // it would reclaim later and resurrect the asset through the pipeline.
    await this.cancelPendingJob(asset.props.id);
  }

  private async cancelPendingJob(assetId: string): Promise<void> {
    await this.processingJobRepo.cancelForAsset({
      assetId,
      reason: ASSET_DELETED_REASON,
      now: new Date(),
    });
  }
}
