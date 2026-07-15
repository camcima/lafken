import { Injectable } from "@nestjs/common";

import type { Asset } from "@/assets/domain/entities/asset.entity";
import { AssetNotFoundError } from "@/assets/domain/errors/asset-not-found.error";
import { AssetNotInQuarantineError } from "@/assets/domain/errors/asset-not-in-quarantine.error";
import { AssetUnderLegalHoldError } from "@/assets/domain/errors/asset-under-legal-hold.error";
import { AssetQueryRepositoryPort } from "@/assets/domain/repositories/asset-query.repository.port";
import { AssetWriteRepositoryPort } from "@/assets/domain/repositories/asset-write.repository.port";
import type { AssetState } from "@/assets/domain/value-objects/asset-state.value-object";
import { AuditWriteRepositoryPort } from "@/audit/domain/repositories/audit-write.repository.port";
import { UnitOfWorkPort } from "@/shared/application/unit-of-work.port";

const AUDIT_FALLBACK_PRINCIPAL = "system";

export interface IRejectQuarantinedAssetInput {
  publicId: string;
  reviewerId: string | null;
  note: string;
  requestIp: string | null;
}

@Injectable()
export class RejectQuarantinedAssetUseCase {
  constructor(
    private readonly assetQueryRepo: AssetQueryRepositoryPort,
    private readonly assetWriteRepo: AssetWriteRepositoryPort,
    private readonly auditWriteRepo: AuditWriteRepositoryPort,
    private readonly unitOfWork: UnitOfWorkPort,
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
    const expectedFromState: AssetState = asset.props.state;

    // Transition + audit write happen inside one unit of work: a committed
    // reject with no audit row (or an audit row with no committed reject)
    // would violate the audit-trail guarantee (F-A9). Reject never touches
    // storage, so — unlike release — there's no GCS call to keep outside the
    // transaction; the whole operation lives inside unitOfWork.execute.
    const updated: Asset | null = await this.unitOfWork.execute(async (): Promise<Asset | null> => {
      const transitioned = await this.assetWriteRepo.transitionState({
        publicId: input.publicId,
        toState: "rejected",
        reason,
        by: input.reviewerId,
        metadata: { note: input.note, decision: "reject" },
        expectedFromState,
      });
      if (!transitioned) {
        return null;
      }

      await this.auditWriteRepo.record({
        entityType: "asset",
        entityId: transitioned.props.publicId,
        action: "reject",
        occurredBy: input.reviewerId ?? AUDIT_FALLBACK_PRINCIPAL,
        requestIp: input.requestIp,
        beforeState: { state: expectedFromState },
        afterState: { state: transitioned.props.state },
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
