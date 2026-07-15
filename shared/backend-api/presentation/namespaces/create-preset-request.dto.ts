import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsString, Matches, MaxLength, ValidateNested } from "class-validator";

import { PRESET_NAME_MAX_LENGTH, PRESET_NAME_PATTERN } from "../../shared/validation-constants";
import { PresetParamsInputDTO } from "./preset-params-input.dto";

export class CreatePresetRequestDTO {
  @IsString()
  @MaxLength(PRESET_NAME_MAX_LENGTH)
  @Matches(PRESET_NAME_PATTERN, {
    message: "name must be lowercase kebab-case (a-z, 0-9, - only)",
  })
  @ApiProperty({ example: "thumbnail" })
  name!: string;

  @ValidateNested()
  @Type(() => PresetParamsInputDTO)
  @ApiProperty({ type: PresetParamsInputDTO })
  params!: PresetParamsInputDTO;
}
