import { Module } from "@nestjs/common";
import { HealthIndicatorService, TerminusModule } from "@nestjs/terminus";

import { AppLoggerPort } from "../shared/application/app-logger.port";
import { LoggerModule } from "../shared/infrastructure/logger/logger.module";
import { DatabaseClient } from "../shared/infrastructure/persistence/database-client";
import { DatabaseModule } from "../shared/infrastructure/persistence/database.module";
import { DatabaseHealthIndicatorService } from "./application/services/database-health-indicator.service";
import { ApiHealthController } from "./presentation/api-health.controller";

@Module({
  imports: [LoggerModule, DatabaseModule, TerminusModule],
  providers: [
    {
      provide: DatabaseHealthIndicatorService,
      inject: [AppLoggerPort, DatabaseClient, HealthIndicatorService],
      useFactory: (
        appLogger: AppLoggerPort,
        databaseClient: DatabaseClient,
        healthIndicatorService: HealthIndicatorService,
      ) => {
        appLogger.setContext(DatabaseHealthIndicatorService.name);

        return new DatabaseHealthIndicatorService(
          appLogger,
          databaseClient,
          healthIndicatorService,
        );
      },
    },
  ],
  controllers: [ApiHealthController],
})
export class HealthModule {}
