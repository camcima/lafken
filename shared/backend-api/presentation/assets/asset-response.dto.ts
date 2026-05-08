import { ApiProperty } from "@nestjs/swagger";

export const ASSET_STATES = [
  "pending",
  "uploaded",
  "processing",
  "ready",
  "rejected",
  "quarantined_virus",
  "quarantined_moderation",
  "processing_failed",
  "expired",
  "deleted",
] as const;

export type AssetState = (typeof ASSET_STATES)[number];

export class AssetResponseDTO {
  @ApiProperty()
  publicId!: string;

  @ApiProperty()
  namespaceSlug!: string;

  @ApiProperty()
  policyVersion!: number;

  @ApiProperty({ enum: ASSET_STATES })
  state!: AssetState;

  @ApiProperty({ required: false, type: String })
  stateReason?: string;

  @ApiProperty({ required: false, type: Number })
  sizeBytes?: number;

  @ApiProperty({ required: false, type: String })
  mimeType?: string;

  @ApiProperty({ required: false, type: String })
  declaredMimeType?: string;

  @ApiProperty({ required: false, type: Number })
  width?: number;

  @ApiProperty({ required: false, type: Number })
  height?: number;

  @ApiProperty({ required: false, type: String })
  contentHashHex?: string;

  @ApiProperty({ required: false, type: String })
  uploadedBy?: string;

  @ApiProperty({ required: false, type: String })
  externalRefType?: string;

  @ApiProperty({ required: false, type: String })
  externalRefId?: string;

  @ApiProperty({ type: Object })
  customMetadata!: Record<string, unknown>;

  @ApiProperty({ required: false, type: Object })
  captureContext?: Record<string, unknown>;

  @ApiProperty()
  legalHold!: boolean;

  @ApiProperty({ required: false, type: String, nullable: true })
  legalHoldReference?: string | null;

  @ApiProperty({ required: false, type: String })
  confirmedAt?: string;

  @ApiProperty()
  stateChangedAt!: string;

  @ApiProperty()
  createdAt!: string;
}
