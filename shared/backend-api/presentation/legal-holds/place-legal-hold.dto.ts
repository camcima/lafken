import { ApiProperty } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  IsUUID,
  Length,
} from "class-validator";

const CASE_REFERENCE_MIN = 3;
const CASE_REFERENCE_MAX = 100;
const DESCRIPTION_MIN = 10;
const DESCRIPTION_MAX = 1000;
const ASSET_IDS_MIN = 1;
const ASSET_IDS_MAX = 1000;

export class PlaceLegalHoldRequestDTO {
  @IsString()
  @Length(CASE_REFERENCE_MIN, CASE_REFERENCE_MAX)
  @ApiProperty({ minLength: CASE_REFERENCE_MIN, maxLength: CASE_REFERENCE_MAX })
  caseReference!: string;

  @IsString()
  @Length(DESCRIPTION_MIN, DESCRIPTION_MAX)
  @ApiProperty({ minLength: DESCRIPTION_MIN, maxLength: DESCRIPTION_MAX })
  description!: string;

  @IsArray()
  @ArrayMinSize(ASSET_IDS_MIN)
  @ArrayMaxSize(ASSET_IDS_MAX)
  @IsUUID(undefined, { each: true })
  @ApiProperty({ type: [String], minItems: ASSET_IDS_MIN, maxItems: ASSET_IDS_MAX })
  assetIds!: string[];
}
