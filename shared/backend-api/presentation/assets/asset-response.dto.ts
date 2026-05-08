import { ApiProperty } from "@nestjs/swagger";

export const ASSET_STATES = [
  "pending",
  "uploaded",
  "processing",
  "ready",
  "rejected",
  "quarantined_virus",
  "quarantined_moderation",
  "quarantined_invalid_format",
  "processing_failed",
  "expired",
  "deleted",
] as const;

export type AssetState = (typeof ASSET_STATES)[number];

export class AssetResponseDTO {
  @ApiProperty({
    description:
      "Internal admin-console identifier (uuidv7). Stable, never rotated. Used by the admin console for routes and admin-API paths. Do NOT expose to external consumers — they get `publicId`.",
  })
  id!: string;

  @ApiProperty({
    description:
      "External-facing identifier (uuidv4). What clients of the public Lafken API see and persist. Used in URLs and bodies of external endpoints (upload-intent confirm, preview-url, download-url).",
  })
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

  @ApiProperty({
    required: false,
    type: String,
    description:
      "16-char hex of the 64-bit DCT perceptual hash. Two visually similar " +
      "images produce a low Hamming distance over these 64 bits. Null/absent " +
      "for non-image payloads or when computation failed.",
  })
  phashHex?: string;

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

  @ApiProperty({
    type: [String],
    description:
      "Free-form tags attached to the asset. First-class column; filterable via `?tags=`.",
  })
  tags!: string[];

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
