import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

import { makePaginatedRequestInputDto } from "../../shared/pagination-dto-factories";

export class ListAuditQueryDTO extends makePaginatedRequestInputDto() {
  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, type: String })
  principal?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, type: String })
  action?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, type: String })
  entityType?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, type: String })
  entityId?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, type: String })
  occurredFrom?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, type: String })
  occurredTo?: string;
}
