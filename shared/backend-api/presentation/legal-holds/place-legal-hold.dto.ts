import { ApiProperty } from "@nestjs/swagger";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, IsUUID, Length } from "class-validator";

import {
  LEGAL_HOLD_ASSET_IDS_MAX,
  LEGAL_HOLD_ASSET_IDS_MIN,
  LEGAL_HOLD_CASE_REFERENCE_MAX_LENGTH,
  LEGAL_HOLD_CASE_REFERENCE_MIN_LENGTH,
  LEGAL_HOLD_DESCRIPTION_MAX_LENGTH,
  LEGAL_HOLD_DESCRIPTION_MIN_LENGTH,
} from "../../shared/validation-constants";

export class PlaceLegalHoldRequestDTO {
  @IsString()
  @Length(LEGAL_HOLD_CASE_REFERENCE_MIN_LENGTH, LEGAL_HOLD_CASE_REFERENCE_MAX_LENGTH)
  @ApiProperty({
    minLength: LEGAL_HOLD_CASE_REFERENCE_MIN_LENGTH,
    maxLength: LEGAL_HOLD_CASE_REFERENCE_MAX_LENGTH,
  })
  caseReference!: string;

  @IsString()
  @Length(LEGAL_HOLD_DESCRIPTION_MIN_LENGTH, LEGAL_HOLD_DESCRIPTION_MAX_LENGTH)
  @ApiProperty({
    minLength: LEGAL_HOLD_DESCRIPTION_MIN_LENGTH,
    maxLength: LEGAL_HOLD_DESCRIPTION_MAX_LENGTH,
  })
  description!: string;

  @IsArray()
  @ArrayMinSize(LEGAL_HOLD_ASSET_IDS_MIN)
  @ArrayMaxSize(LEGAL_HOLD_ASSET_IDS_MAX)
  @IsUUID(undefined, { each: true })
  @ApiProperty({
    type: [String],
    minItems: LEGAL_HOLD_ASSET_IDS_MIN,
    maxItems: LEGAL_HOLD_ASSET_IDS_MAX,
  })
  assetIds!: string[];
}
