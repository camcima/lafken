import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

const MIN_NOTE_LENGTH = 12;
const MAX_NOTE_LENGTH = 4000;

export class RejectQuarantinedAssetRequestDTO {
  @IsString()
  @MinLength(MIN_NOTE_LENGTH)
  @MaxLength(MAX_NOTE_LENGTH)
  @ApiProperty({
    type: String,
    description:
      "Reviewer note explaining why the asset is being rejected. Required, minimum 12 characters. Stored under the asset_state_transitions metadata.",
  })
  note!: string;
}

export const REJECT_QUARANTINED_ASSET_LIMITS = {
  MIN_NOTE_LENGTH,
  MAX_NOTE_LENGTH,
} as const;
