import type { LegalHoldResponseDTO } from "@shared/backend-api";

import type { LegalHold } from "@/legal-holds/domain/entities/legal-hold.entity";

export class LegalHoldResponseMapper {
  static fromDomain(hold: LegalHold, affectedAssetCount: number): LegalHoldResponseDTO {
    return {
      id: hold.props.id.toString(),
      caseReference: hold.props.caseReference,
      description: hold.props.description,
      scopeSummary: hold.props.scopeSummary,
      placedBy: hold.props.placedBy,
      placedAt: hold.props.placedAt.toISOString(),
      liftedBy: hold.props.liftedBy ?? undefined,
      liftedAt: hold.props.liftedAt?.toISOString() ?? undefined,
      liftReason: hold.props.liftReason ?? undefined,
      active: hold.props.active,
      affectedAssetCount,
    };
  }
}
