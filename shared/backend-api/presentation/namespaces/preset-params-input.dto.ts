import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsInt, IsNumber, IsOptional, Max, Min } from "class-validator";

export const PRESET_FITS = ["cover", "contain", "fill", "inside", "outside"] as const;
export type PresetFitDTO = (typeof PRESET_FITS)[number];
export const PRESET_FORMATS = ["webp", "avif", "jpeg", "png", "auto"] as const;
export type PresetFormatDTO = (typeof PRESET_FORMATS)[number];

export class PresetParamsInputDTO {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  @ApiProperty({ required: false, type: Number, nullable: true, minimum: 1, maximum: 10000 })
  width?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  @ApiProperty({ required: false, type: Number, nullable: true, minimum: 1, maximum: 10000 })
  height?: number | null;

  @IsEnum(PRESET_FITS)
  @ApiProperty({ enum: PRESET_FITS })
  fit!: PresetFitDTO;

  @IsEnum(PRESET_FORMATS)
  @ApiProperty({ enum: PRESET_FORMATS })
  format!: PresetFormatDTO;

  @IsInt()
  @Min(1)
  @Max(100)
  @ApiProperty({ minimum: 1, maximum: 100 })
  quality!: number;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(4)
  @ApiProperty({ required: false, type: Number, nullable: true, minimum: 0.5, maximum: 4 })
  dpr?: number | null;
}
