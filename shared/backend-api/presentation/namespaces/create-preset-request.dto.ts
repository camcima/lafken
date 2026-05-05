import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsString, Matches, MaxLength, ValidateNested } from "class-validator";

import { PresetParamsInputDTO } from "./preset-params-input.dto";

export class CreatePresetRequestDTO {
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, {
    message: "name must be lowercase kebab-case (a-z, 0-9, - only)",
  })
  @ApiProperty({ example: "thumbnail" })
  name!: string;

  @ValidateNested()
  @Type(() => PresetParamsInputDTO)
  @ApiProperty({ type: PresetParamsInputDTO })
  params!: PresetParamsInputDTO;
}
