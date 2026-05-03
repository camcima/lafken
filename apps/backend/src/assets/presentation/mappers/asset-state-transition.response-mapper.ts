import { AssetStateTransitionResponseDTO } from "@shared/backend-api";

import type { AssetStateTransition } from "@/assets/domain/entities/asset-state-transition.entity";

export class AssetStateTransitionResponseMapper {
  static fromDomain(transition: AssetStateTransition): AssetStateTransitionResponseDTO {
    return {
      fromState: transition.props.fromState ?? undefined,
      toState: transition.props.toState,
      reason: transition.props.reason ?? undefined,
      metadata: transition.props.metadata ?? undefined,
      occurredBy: transition.props.occurredBy ?? undefined,
      occurredAt: transition.props.occurredAt.toISOString(),
    };
  }
}
