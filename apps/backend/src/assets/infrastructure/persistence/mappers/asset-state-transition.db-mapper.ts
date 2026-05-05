import { AssetStateTransition } from "@/assets/domain/entities/asset-state-transition.entity";
import type { AssetState } from "@/assets/domain/value-objects/asset-state.value-object";

export class AssetStateTransitionDbMapper {
  static toDomain(row: Record<string, any>): AssetStateTransition {
    return AssetStateTransition.fromProps({
      id: row["id"] as string,
      assetId: row["asset_id"] as string,
      fromState: (row["from_state"] as AssetState | null) ?? null,
      toState: row["to_state"] as AssetState,
      reason: (row["reason"] as string | null) ?? null,
      metadata: (row["metadata"] as Record<string, unknown> | null) ?? null,
      occurredBy: (row["occurred_by"] as string | null) ?? null,
      occurredAt: new Date(row["occurred_at"] as string),
      createdAt: new Date(row["created_at"] as string),
      updatedAt: new Date(row["updated_at"] as string),
    });
  }
}
