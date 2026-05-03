import { ApiProperty } from "@nestjs/swagger";

const HEALTH_CHECK_STATUS_ENUM = {
  error: "error",
  ok: "ok",
  shutting_down: "shutting_down",
} as const;

class HealthIndicatorStatusDTO {
  @ApiProperty({
    enum: ["up", "down"],
    description: "Status of the specific health indicator",
  })
  status: "up" | "down";
}

class HealthIndicatorResultResponseDTO {
  @ApiProperty({
    type: HealthIndicatorStatusDTO,
    required: false,
  })
  application?: HealthIndicatorStatusDTO;

  @ApiProperty({
    type: HealthIndicatorStatusDTO,
    required: false,
  })
  database?: HealthIndicatorStatusDTO;
}

export class HealthCheckResultResponseDTO {
  @ApiProperty({
    enum: HEALTH_CHECK_STATUS_ENUM,
  })
  status: keyof typeof HEALTH_CHECK_STATUS_ENUM;

  @ApiProperty({
    type: HealthIndicatorResultResponseDTO,
    description: "Summary information about healthy health indicators",
  })
  info: HealthIndicatorResultResponseDTO;

  @ApiProperty({
    type: HealthIndicatorResultResponseDTO,
    description: "Summary information about failed health indicators",
  })
  error: HealthIndicatorResultResponseDTO;

  @ApiProperty({
    type: HealthIndicatorResultResponseDTO,
    description: "Details about all health indicators",
  })
  details: HealthIndicatorResultResponseDTO;
}
