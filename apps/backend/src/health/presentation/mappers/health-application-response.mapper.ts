import { HealthCheckResult } from "@nestjs/terminus";

import { HealthCheckResultResponseDTO } from "../dto/health-check-result.dto";

export class HealthApplicationResponseMapper {
  static fromDomain(healthCheckResult: HealthCheckResult): HealthCheckResultResponseDTO {
    const dto = new HealthCheckResultResponseDTO();
    dto.status = healthCheckResult.status;
    dto.info = healthCheckResult.info || {};
    dto.error = healthCheckResult.error || {};
    dto.details = healthCheckResult.details;
    return dto;
  }
}
