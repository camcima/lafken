import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";

import { makePaginatedRequestInputDto } from "../../shared/pagination-dto-factories";

export class ListQuarantineQueryDTO extends makePaginatedRequestInputDto() {
  @IsOptional()
  @IsIn(["virus", "moderation", "invalid_format"])
  @ApiProperty({ required: false, enum: ["virus", "moderation", "invalid_format"] })
  kind?: "virus" | "moderation" | "invalid_format";

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, type: String })
  namespaceSlug?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, type: String })
  flaggedFrom?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, type: String })
  flaggedTo?: string;
}
