import { HealthIndicatorResult, HealthIndicatorService } from "@nestjs/terminus";

import { AppLoggerPort } from "@/shared/application/app-logger.port";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";

export class DatabaseHealthIndicatorService {
  constructor(
    private readonly logger: AppLoggerPort,
    private readonly databaseClient: DatabaseClient,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async isHealthy(): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check("database");

    try {
      const isConnectionStablishResult = await this.databaseClient.isConnected({
        retryAttempts: 2,
        retryDelayMs: 2_000,
      });
      const isHealthy = isConnectionStablishResult.ok;
      if (isHealthy) {
        return indicator.up();
      } else {
        throw isConnectionStablishResult.error;
      }
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(error.message);
      } else {
        this.logger.error(`Unknown error during database health check`, error);
      }

      return indicator.down({ message: "Database connection failed" });
    }
  }
}
