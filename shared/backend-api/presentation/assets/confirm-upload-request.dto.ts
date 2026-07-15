import { ApiProperty } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from "class-validator";

// Limits mirror the upload page's client-side constraints
// (apps/web/src/features/assets/components/UploadAssetsPage.tsx).
const MAX_EXTERNAL_REF_LENGTH = 255;
const MAX_NOTE_LENGTH = 4000;
const MAX_TAGS = 32;
const MAX_TAG_LENGTH = 64;

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

  @IsString()
  @MaxLength(MAX_EXTERNAL_REF_LENGTH)
  @IsOptional()
  @ApiProperty({ required: false, type: String, example: "work_order" })
  externalRefType?: string;

  @IsString()
  @MaxLength(MAX_EXTERNAL_REF_LENGTH)
  @IsOptional()
  @ApiProperty({ required: false, type: String, example: "wo-2026-04-29-N12345-018" })
  externalRefId?: string;

  /** Free-text uploader note. Persisted under the asset's `customMetadata.note`. */
  @IsString()
  @MaxLength(MAX_NOTE_LENGTH)
  @IsOptional()
  @ApiProperty({ required: false, type: String })
  note?: string;

  @IsArray()
  @ArrayMaxSize(MAX_TAGS)
  @IsString({ each: true })
  @MaxLength(MAX_TAG_LENGTH, { each: true })
  @IsOptional()
  @ApiProperty({ required: false, type: [String] })
  tags?: string[];
}
