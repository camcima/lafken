import { Injectable } from "@nestjs/common";

import type { Asset } from "@/assets/domain/entities/asset.entity";
import { AssetNotFoundError } from "@/assets/domain/errors/asset-not-found.error";
import { AssetNotInQuarantineError } from "@/assets/domain/errors/asset-not-in-quarantine.error";
import { AssetUnderLegalHoldError } from "@/assets/domain/errors/asset-under-legal-hold.error";
import { AssetQueryRepositoryPort } from "@/assets/domain/repositories/asset-query.repository.port";
import { AssetWriteRepositoryPort } from "@/assets/domain/repositories/asset-write.repository.port";

export interface IRejectQuarantinedAssetInput {
  publicId: string;
  reviewerId: string | null;
  note: string;
}

@Injectable()
export class RejectQuarantinedAssetUseCase {
  constructor(
    private readonly assetQueryRepo: AssetQueryRepositoryPort,
    private readonly assetWriteRepo: AssetWriteRepositoryPort,
  ) {}

  async execute(input: IRejectQuarantinedAssetInput): Promise<Asset> {
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
        operation: "rejected",
      });
    }

    const reason = `rejected_from_quarantine: ${input.note.trim()}`;

    const updated = await this.assetWriteRepo.transitionState({
      publicId: input.publicId,
      toState: "rejected",
      reason,
      by: input.reviewerId,
      metadata: { note: input.note, decision: "reject" },
    });

    if (!updated) {
      throw new AssetNotFoundError({ publicId: input.publicId });
    }
    return updated;
  }
}
