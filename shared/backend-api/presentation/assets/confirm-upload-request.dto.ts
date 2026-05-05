import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsOptional, IsPositive } from "class-validator";

export class ConfirmUploadRequestDTO {
  @IsInt()
  @IsPositive()
  @IsOptional()
  @ApiProperty({ required: false, type: Number })
  width?: number;

  @IsInt()
  @IsPositive()
  @IsOptional()
  @ApiProperty({ required: false, type: Number })
  height?: number;
}
