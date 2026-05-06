import type { QuarantineKind } from "../value-objects/quarantine-kind.value-object";

export interface QuarantinedAssetViewProps {
  // base asset fields (subset needed for response)
  publicId: string;
  namespaceSlug: string;
  policyVersion: number;
  state: string;
  stateReason: string | null;
  sizeBytes: bigint | null;
  mimeType: string | null;
  declaredMimeType: string | null;
  width: number | null;
  height: number | null;
  contentHash: Buffer | null;
  uploadedBy: string | null;
  externalRefType: string | null;
  externalRefId: string | null;
  customMetadata: Record<string, unknown>;
  captureContext: Record<string, unknown> | null;
  legalHold: boolean;
  confirmedAt: Date | null;
  stateChangedAt: Date;
  createdAt: Date;
  // quarantine-specific fields
  quarantineKind: QuarantineKind;
  flaggedAnalyzer: string | null;
  flaggedCategory: string | null;
  flaggedScore: number | null;
  flaggedAt: Date;
}

export class QuarantinedAssetView {
  constructor(public readonly props: QuarantinedAssetViewProps) {}

  static fromProps(props: QuarantinedAssetViewProps): QuarantinedAssetView {
    return new QuarantinedAssetView(props);
  }
}
