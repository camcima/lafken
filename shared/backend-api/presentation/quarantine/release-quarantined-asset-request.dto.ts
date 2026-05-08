import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

const MAX_NOTE_LENGTH = 4000;

export class ReleaseQuarantinedAssetRequestDTO {
  @IsOptional()
  @IsString()
  @MaxLength(MAX_NOTE_LENGTH)
  @ApiProperty({
    required: false,
    type: String,
    description:
      "Optional reviewer note explaining why the asset is being released. Stored under the asset_state_transitions metadata for audit.",
  })
  note?: string;
}
