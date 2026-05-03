import { ApiProperty } from "@nestjs/swagger";

export class AssetAnalysisResponseDTO {
  @ApiProperty()
  analyzer!: string;

  @ApiProperty({ required: false, type: String })
  analyzerVersion?: string;

  @ApiProperty({ type: Object })
  findings!: Record<string, unknown>;

  @ApiProperty({ required: false, enum: ["pass", "flag", "quarantine", "error"] })
  decision?: "pass" | "flag" | "quarantine" | "error";

  @ApiProperty()
  occurredAt!: string;
}
