import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ValidateNested } from "class-validator";

import { PresetParamsInputDTO } from "./preset-params-input.dto";

export class UpdatePresetVersionRequestDTO {
  @ValidateNested()
  @Type(() => PresetParamsInputDTO)
  @ApiProperty({ type: PresetParamsInputDTO })
  params!: PresetParamsInputDTO;
}
