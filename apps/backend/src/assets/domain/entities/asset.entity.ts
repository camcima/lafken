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
  /**
   * 64-bit DCT-based perceptual hash (sharp-phash output, packed into 8
   * bytes). Null until image inspection runs; null forever for non-image
   * payloads. Used for visual-similarity reasoning, not for identity —
   * `contentHash` is still the canonical bytewise fingerprint.
   */
  phash: Buffer | null;
  uploadedBy: string | null;
  externalRefType: string | null;
  externalRefId: string | null;
  customMetadata: Record<string, unknown>;
  captureContext: Record<string, unknown> | null;
  tags: string[];
  legalHold: boolean;
  legalHoldReference: string | null;
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
