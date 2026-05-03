import { Controller, Get, Res, ServiceUnavailableException } from "@nestjs/common";
import { ApiOkResponse, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { HealthCheckService, HealthIndicatorService } from "@nestjs/terminus";
import type { Response } from "express";

import { DatabaseHealthIndicatorService } from "../application/services/database-health-indicator.service";
import { HealthCheckResultResponseDTO } from "./dto/health-check-result.dto";
import { HealthApplicationResponseMapper } from "./mappers/health-application-response.mapper";

/**
 * Health endpoints are intentionally public so Cloud Run liveness/startup
 * probes and external load balancers can reach them without an auth token.
 * `@ApiSecurity({})` overrides the globally-applied `azure_ad_jwt`
 * requirement so the generated Cloud Endpoints spec advertises the same
 * thing that the NestJS app actually enforces.
 */
@Controller("health")
@ApiTags("Health")
@ApiSecurity({})
export class ApiHealthController {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly healthCheckService: HealthCheckService,
    private readonly databaseHealthIndicatorService: DatabaseHealthIndicatorService,
  ) {}

  @Get()
  @ApiOkResponse({ type: HealthCheckResultResponseDTO })
  async checkHealth(
    @Res({ passthrough: true }) res: Response,
  ): Promise<HealthCheckResultResponseDTO> {
    try {
      const appIndicator = this.healthIndicatorService.check("application");

      const healthCheckResult = await this.healthCheckService.check([
        () => appIndicator.up(),
        () => this.databaseHealthIndicatorService.isHealthy(),
      ]);

      return HealthApplicationResponseMapper.fromDomain(healthCheckResult);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        res.status(error.getStatus());
        const healthCheckErrorResult = error.getResponse() as HealthCheckResultResponseDTO;
        return healthCheckErrorResult;
      }

      throw error;
    }
  }
}
