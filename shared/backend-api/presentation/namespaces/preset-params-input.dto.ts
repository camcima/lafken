import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsInt, IsNumber, IsOptional, Max, Min } from "class-validator";

import {
  PRESET_DIMENSION_MAX,
  PRESET_DIMENSION_MIN,
  PRESET_DPR_MAX,
  PRESET_DPR_MIN,
  PRESET_FITS,
  PRESET_FORMATS,
  PRESET_QUALITY_MAX,
  PRESET_QUALITY_MIN,
} from "../../shared/validation-constants";

export type PresetFitDTO = (typeof PRESET_FITS)[number];
export type PresetFormatDTO = (typeof PRESET_FORMATS)[number];

export class PresetParamsInputDTO {
  @IsOptional()
  @IsInt()
  @Min(PRESET_DIMENSION_MIN)
  @Max(PRESET_DIMENSION_MAX)
  @ApiProperty({
    required: false,
    type: Number,
    nullable: true,
    minimum: PRESET_DIMENSION_MIN,
    maximum: PRESET_DIMENSION_MAX,
  })
  width?: number | null;

  @IsOptional()
  @IsInt()
  @Min(PRESET_DIMENSION_MIN)
  @Max(PRESET_DIMENSION_MAX)
  @ApiProperty({
    required: false,
    type: Number,
    nullable: true,
    minimum: PRESET_DIMENSION_MIN,
    maximum: PRESET_DIMENSION_MAX,
  })
  height?: number | null;

  @IsEnum(PRESET_FITS)
  @ApiProperty({ enum: PRESET_FITS })
  fit!: PresetFitDTO;

  @IsEnum(PRESET_FORMATS)
  @ApiProperty({ enum: PRESET_FORMATS })
  format!: PresetFormatDTO;

  @IsInt()
  @Min(PRESET_QUALITY_MIN)
  @Max(PRESET_QUALITY_MAX)
  @ApiProperty({ minimum: PRESET_QUALITY_MIN, maximum: PRESET_QUALITY_MAX })
  quality!: number;

  @IsOptional()
  @IsNumber()
  @Min(PRESET_DPR_MIN)
  @Max(PRESET_DPR_MAX)
  @ApiProperty({
    required: false,
    type: Number,
    nullable: true,
    minimum: PRESET_DPR_MIN,
    maximum: PRESET_DPR_MAX,
  })
  dpr?: number | null;
}
