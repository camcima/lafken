import type { AssetState } from "../value-objects/asset-state.value-object";

export interface IAssetStateTransitionProps {
  id: string;
  assetId: string;
  fromState: AssetState | null;
  toState: AssetState;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  occurredBy: string | null;
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class AssetStateTransition {
  constructor(public readonly props: IAssetStateTransitionProps) {}

  static fromProps(props: IAssetStateTransitionProps): AssetStateTransition {
    return new AssetStateTransition(props);
  }
}
