import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class SetPresetActiveRequestDTO {
  @IsBoolean()
  @ApiProperty()
  active!: boolean;
}
