import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_FILE_SIZE = 5_368_709_120; // 5 GiB
const MAX_TTL_SECONDS = 7 * 24 * 60 * 60;
const MAX_BUCKET_SIZE = 86_400;
const MAX_RETENTION_DAYS = 36_500;

export class CreateNamespacePolicyDTO {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_RETENTION_DAYS)
  @ApiProperty({ required: false, type: Number, nullable: true })
  retentionDays!: number | null;

  @IsIn(["delete", "archive", "none"])
  @ApiProperty({ enum: ["delete", "archive", "none"] })
  retentionMode!: "delete" | "archive" | "none";

  @IsInt()
  @Min(1)
  @Max(MAX_FILE_SIZE)
  @ApiProperty({ type: Number, example: 52428800 })
  maxFileSizeBytes!: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @ApiProperty({ type: [String], example: ["image/jpeg", "image/png", "image/webp"] })
  allowedMimeTypes!: string[];

  @IsIn(["strip", "preserve", "extract_then_strip"])
  @ApiProperty({ enum: ["strip", "preserve", "extract_then_strip"] })
  exifHandling!: "strip" | "preserve" | "extract_then_strip";

  @IsBoolean()
  @ApiProperty({ type: Boolean })
  virusScanRequired!: boolean;

  @IsOptional()
  @IsObject()
  @ApiProperty({ required: false, type: Object, nullable: true })
  contentModeration!: Record<string, unknown> | null;

  @IsOptional()
  @IsObject()
  @ApiProperty({ required: false, type: Object, nullable: true })
  requiredMetadataSchema!: Record<string, unknown> | null;

  @IsBoolean()
  @ApiProperty({ type: Boolean })
  immutable!: boolean;

  @IsIn(["public", "signed", "proxied"])
  @ApiProperty({ enum: ["public", "signed", "proxied"] })
  servingMode!: "public" | "signed" | "proxied";

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_TTL_SECONDS)
  @ApiProperty({ required: false, type: Number, nullable: true })
  signedUrlTtlSeconds!: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_BUCKET_SIZE)
  @ApiProperty({ required: false, type: Number, nullable: true })
  signedUrlBucketSize!: number | null;

  @IsOptional()
  @IsObject()
  @ApiProperty({ required: false, type: Object, nullable: true })
  retryConfig!: Record<string, unknown> | null;
}

export class CreateNamespaceRequestDTO {
  @IsString()
  @Matches(SLUG_PATTERN)
  @MaxLength(64)
  @ApiProperty({ example: "aircraft-photos" })
  slug!: string;

  @IsString()
  @MaxLength(200)
  @ApiProperty({ example: "Aircraft photos" })
  displayName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @ApiProperty({ required: false, type: String, nullable: true })
  description!: string | null;

  @IsUUID()
  @ApiProperty({ description: "ID of an existing storage binding (UUID)", format: "uuid" })
  storageBindingId!: string;

  @ValidateNested()
  @Type(() => CreateNamespacePolicyDTO)
  @ApiProperty({ type: CreateNamespacePolicyDTO })
  policy!: CreateNamespacePolicyDTO;
}
