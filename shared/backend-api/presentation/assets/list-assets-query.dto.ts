import { ApiProperty } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsArray, IsIn, IsOptional, IsString } from "class-validator";

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
  @IsString()
  @ApiProperty({ required: false, type: String })
  uploadedFrom?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, type: String })
  uploadedTo?: string;
}
