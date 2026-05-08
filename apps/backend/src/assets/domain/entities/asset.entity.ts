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

export interface IMakeUploadedInput {
  publicId: string;
  namespaceId: string;
  policyVersionId: string;
  storageBindingId: string;
  storageKey: string;
  declaredMimeType: string;
  declaredSizeBytes: bigint;
  uploadedBy: string | null;
  width?: number | null;
  height?: number | null;
}

export class Asset {
  constructor(public readonly props: IAssetProps) {}

  static fromProps(props: IAssetProps): Asset {
    return new Asset(props);
  }

  /**
   * Factory for the moment immediately after the BE confirms a successful PUT
   * to the GCS signed URL. The DB-side `id`, `createdAt`, `updatedAt`,
   * `state_changed_at`, and `confirmed_at` columns are populated by Postgres
   * defaults, so this factory only models what the use case knows at the
   * point of insertion.
   */
  static makeUploaded(input: IMakeUploadedInput): IAssetProps {
    const now = new Date();
    return {
      id: "00000000-0000-0000-0000-000000000000",
      publicId: input.publicId,
      namespaceId: input.namespaceId,
      policyVersionId: input.policyVersionId,
      storageBindingId: input.storageBindingId,
      storageKey: input.storageKey,
      state: "uploaded",
      stateReason: null,
      sizeBytes: input.declaredSizeBytes,
      mimeType: null,
      declaredMimeType: input.declaredMimeType,
      width: input.width ?? null,
      height: input.height ?? null,
      contentHash: null,
      phash: null,
      uploadedBy: input.uploadedBy,
      externalRefType: null,
      externalRefId: null,
      customMetadata: {},
      captureContext: null,
      tags: [],
      legalHold: false,
      legalHoldReference: null,
      confirmedAt: now,
      stateChangedAt: now,
      createdAt: now,
      updatedAt: now,
    };
  }
}
