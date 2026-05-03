import { ApiProperty } from "@nestjs/swagger";

import { IntegrationStatusResponseDTO } from "./integration-status-response.dto";

export class SystemHealthIndicatorDTO {
  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ["ok", "degraded", "failing", "unknown"] })
  status!: "ok" | "degraded" | "failing" | "unknown";

  @ApiProperty({ required: false, type: String })
  detail?: string;
}

export class SystemHealthResponseDTO {
  @ApiProperty({ enum: ["ok", "degraded", "failing", "unknown"] })
  overall!: "ok" | "degraded" | "failing" | "unknown";

  @ApiProperty({ type: [SystemHealthIndicatorDTO] })
  indicators!: SystemHealthIndicatorDTO[];

  @ApiProperty({ type: [IntegrationStatusResponseDTO] })
  integrations!: IntegrationStatusResponseDTO[];
}
