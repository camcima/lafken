import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

import {
  NAMESPACE_DESCRIPTION_MAX_LENGTH,
  NAMESPACE_DISPLAY_NAME_MAX_LENGTH,
} from "../../shared/validation-constants";

export class UpdateNamespaceMetadataRequestDTO {
  @IsString()
  @MaxLength(NAMESPACE_DISPLAY_NAME_MAX_LENGTH)
  @ApiProperty()
  displayName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(NAMESPACE_DESCRIPTION_MAX_LENGTH)
  @ApiProperty({ required: false, type: String, nullable: true })
  description!: string | null;
}
