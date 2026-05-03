import { ApiProperty } from "@nestjs/swagger";

export class LegalHoldResponseDTO {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  caseReference!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty()
  scopeSummary!: string;

  @ApiProperty()
  placedBy!: string;

  @ApiProperty()
  placedAt!: string;

  @ApiProperty({ required: false, type: String })
  liftedBy?: string;

  @ApiProperty({ required: false, type: String })
  liftedAt?: string;

  @ApiProperty({ required: false, type: String })
  liftReason?: string;

  @ApiProperty()
  active!: boolean;

  @ApiProperty()
  affectedAssetCount!: number;
}
