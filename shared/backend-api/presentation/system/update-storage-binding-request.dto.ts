import { ApiProperty } from "@nestjs/swagger";
import { IsObject } from "class-validator";

export class UpdateStorageBindingRequestDTO {
  @IsObject()
  @ApiProperty({ type: Object })
  config!: Record<string, unknown>;
}
