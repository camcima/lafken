import type { AssetState } from "../value-objects/asset-state.value-object";

export interface IAssetProps {
  id: string;
  publicId: string;
  namespaceId: string;
  policyVersionId: string;
  storageBindingId: string;
  storageKey: string;
  state: AssetState;
  stateReason: string | null;
  sizeBytes: bigint | null;
  mimeType: string | null;
  declaredMimeType: string | null;
  width: number | null;
  height: number | null;
  contentHash: Buffer | null;
  uploadedBy: string | null;
  owningRecordType: string | null;
  owningRecordId: string | null;
  customMetadata: Record<string, unknown>;
  captureContext: Record<string, unknown> | null;
  legalHold: boolean;
  confirmedAt: Date | null;
  stateChangedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class Asset {
  constructor(public readonly props: IAssetProps) {}

  static fromProps(props: IAssetProps): Asset {
    return new Asset(props);
  }
}
