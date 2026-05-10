import { Injectable } from "@nestjs/common";

import { AuditWriteRepositoryPort } from "@/audit/domain/repositories/audit-write.repository.port";
import type { LegalHold } from "@/legal-holds/domain/entities/legal-hold.entity";
import { LegalHoldAlreadyLiftedError } from "@/legal-holds/domain/errors/legal-hold-already-lifted.error";
import { LegalHoldNotFoundError } from "@/legal-holds/domain/errors/legal-hold-not-found.error";
import { LegalHoldQueryRepositoryPort } from "@/legal-holds/domain/repositories/legal-hold-query.repository.port";
import { LegalHoldWriteRepositoryPort } from "@/legal-holds/domain/repositories/legal-hold-write.repository.port";
import { UnitOfWorkPort } from "@/shared/application/unit-of-work.port";

export interface ILiftLegalHoldUseCaseInput {
  holdId: string;
  liftedBy: string;
  liftReason: string;
  requestIp: string | null;
}

@Injectable()
export class LiftLegalHoldUseCase {
  constructor(
    private readonly queryRepo: LegalHoldQueryRepositoryPort,
    private readonly writeRepo: LegalHoldWriteRepositoryPort,
    private readonly auditWriteRepo: AuditWriteRepositoryPort,
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(input: ILiftLegalHoldUseCaseInput): Promise<LegalHold> {
    const hold = await this.queryRepo.findById(input.holdId);
    if (hold === null) {
      throw new LegalHoldNotFoundError({ id: input.holdId });
    }
    if (!hold.props.active) {
      throw new LegalHoldAlreadyLiftedError({ id: input.holdId });
    }

    const assetInternalIds = await this.queryRepo.listAssetInternalIds(input.holdId);

    return this.unitOfWork.execute(async () => {
      const lifted: LegalHold = await this.writeRepo.liftHold({
        id: input.holdId,
        liftedBy: input.liftedBy,
        liftReason: input.liftReason,
        assetInternalIds,
      });

      await this.auditWriteRepo.record({
        entityType: "legal_hold",
        entityId: lifted.props.id,
        action: "lift",
        occurredBy: input.liftedBy,
        requestIp: input.requestIp,
        reason: input.liftReason,
        beforeState: { active: true },
        afterState: { active: false, assetCount: assetInternalIds.length },
      });

      return lifted;
    });
  }
}
