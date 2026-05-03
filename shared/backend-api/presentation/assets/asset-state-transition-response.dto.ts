import { ApiProperty } from "@nestjs/swagger";

import { ASSET_STATES, type AssetState } from "./asset-response.dto";

export class AssetStateTransitionResponseDTO {
  @ApiProperty({ required: false, enum: ASSET_STATES })
  fromState?: AssetState;

  @ApiProperty({ enum: ASSET_STATES })
  toState!: AssetState;

  @ApiProperty({ required: false, type: String })
  reason?: string;

  @ApiProperty({ required: false, type: Object })
  metadata?: Record<string, unknown>;

  @ApiProperty({ required: false, type: String })
  occurredBy?: string;

  @ApiProperty()
  occurredAt!: string;
}
