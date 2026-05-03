import { ApiProperty } from "@nestjs/swagger";

export class NamespacePolicyResponseDTO {
  @ApiProperty()
  version!: number;

  @ApiProperty({ required: false, type: Number })
  retentionDays?: number;

  @ApiProperty({ enum: ["delete", "archive", "none"] })
  retentionMode!: "delete" | "archive" | "none";

  @ApiProperty()
  maxFileSizeBytes!: number;

  @ApiProperty({ type: [String] })
  allowedMimeTypes!: string[];

  @ApiProperty({ enum: ["strip", "preserve", "extract_then_strip"] })
  exifHandling!: "strip" | "preserve" | "extract_then_strip";

  @ApiProperty()
  virusScanRequired!: boolean;

  @ApiProperty({ required: false, type: Object })
  contentModeration?: Record<string, unknown>;

  @ApiProperty({ required: false, type: Object })
  requiredMetadataSchema?: Record<string, unknown>;

  @ApiProperty()
  immutable!: boolean;

  @ApiProperty({ enum: ["public", "signed", "proxied"] })
  servingMode!: "public" | "signed" | "proxied";

  @ApiProperty({ required: false, type: Number })
  signedUrlTtlSeconds?: number;

  @ApiProperty({ required: false, type: Number })
  signedUrlBucketSize?: number;

  @ApiProperty({ required: false, type: Object })
  retryConfig?: Record<string, unknown>;

  @ApiProperty({ required: false, type: String })
  createdBy?: string;

  @ApiProperty()
  createdAt!: string;
}
