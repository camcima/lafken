import { ApiProperty } from "@nestjs/swagger";

export class IntegrationStatusResponseDTO {
  @ApiProperty()
  port!: string;

  @ApiProperty()
  adapter!: string;

  @ApiProperty({ enum: ["configured", "not_configured"] })
  status!: "configured" | "not_configured";

  @ApiProperty({ required: false, type: String })
  detail?: string;
}
