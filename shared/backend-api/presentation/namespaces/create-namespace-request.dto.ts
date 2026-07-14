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

import {
  NAMESPACE_DESCRIPTION_MAX_LENGTH,
  NAMESPACE_DISPLAY_NAME_MAX_LENGTH,
  NAMESPACE_SLUG_MAX_LENGTH,
  NAMESPACE_SLUG_PATTERN,
  POLICY_MAX_FILE_SIZE_BYTES,
  POLICY_MAX_RETENTION_DAYS,
  POLICY_MAX_SIGNED_URL_BUCKET_SIZE,
  POLICY_MAX_TTL_SECONDS,
} from "../../shared/validation-constants";

export class CreateNamespacePolicyDTO {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(POLICY_MAX_RETENTION_DAYS)
  @ApiProperty({ required: false, type: Number, nullable: true })
  retentionDays!: number | null;

  @IsIn(["delete", "archive", "none"])
  @ApiProperty({ enum: ["delete", "archive", "none"] })
  retentionMode!: "delete" | "archive" | "none";

  @IsInt()
  @Min(1)
  @Max(POLICY_MAX_FILE_SIZE_BYTES)
  @ApiProperty({ type: Number, example: 52428800 })
  maxFileSizeBytes!: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @ApiProperty({ type: [String], example: ["image/jpeg", "image/png", "image/webp"] })
  allowedMimeTypes!: string[];

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
  @Max(POLICY_MAX_TTL_SECONDS)
  @ApiProperty({ required: false, type: Number, nullable: true })
  signedUrlTtlSeconds!: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(POLICY_MAX_SIGNED_URL_BUCKET_SIZE)
  @ApiProperty({ required: false, type: Number, nullable: true })
  signedUrlBucketSize!: number | null;

  @IsOptional()
  @IsObject()
  @ApiProperty({ required: false, type: Object, nullable: true })
  retryConfig!: Record<string, unknown> | null;
}

export class CreateNamespaceRequestDTO {
  @IsString()
  @Matches(NAMESPACE_SLUG_PATTERN)
  @MaxLength(NAMESPACE_SLUG_MAX_LENGTH)
  @ApiProperty({ example: "aircraft-photos" })
  slug!: string;

  @IsString()
  @MaxLength(NAMESPACE_DISPLAY_NAME_MAX_LENGTH)
  @ApiProperty({ example: "Aircraft photos" })
  displayName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(NAMESPACE_DESCRIPTION_MAX_LENGTH)
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
