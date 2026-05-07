import { ApiProperty } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsArray, IsIn, IsOptional, IsString, IsUUID } from "class-validator";

import { makePaginatedRequestInputDto } from "../../shared/pagination-dto-factories";

import { ASSET_STATES, type AssetState } from "./asset-response.dto";

export class ListAssetsQueryDTO extends makePaginatedRequestInputDto() {
  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, type: String })
  namespaceSlug?: string;

  @IsOptional()
  @Type(() => String)
  @IsArray()
  @Transform(({ value }): unknown =>
    Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : value,
  )
  @IsIn(ASSET_STATES, { each: true })
  @ApiProperty({ required: false, enum: ASSET_STATES, isArray: true })
  states?: AssetState[];

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, type: String })
  uploadedBy?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, type: String })
  externalRefType?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, type: String })
  externalRefId?: string;

  @IsOptional()
  @Type(() => String)
  @IsArray()
  @Transform(({ value }): unknown =>
    Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : value,
  )
  @IsString({ each: true })
  @ApiProperty({
    required: false,
    type: [String],
    description:
      "Filter by tags. Comma-separated. Asset must contain ALL listed tags (`array @> ARRAY[...]`).",
  })
  tags?: string[];

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, type: String })
  uploadedFrom?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, type: String })
  uploadedTo?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    required: false,
    type: String,
    description:
      "Free-text search applied across public_id, external_ref_id, uploaded_by, " +
      "the hex-encoded content_hash, and any tag value. Matches are case-insensitive substring.",
  })
  q?: string;

  @IsOptional()
  @IsUUID()
  @ApiProperty({
    required: false,
    type: String,
    description: "Filter to assets covered by a specific legal hold (active or lifted).",
  })
  legalHoldId?: string;
}
