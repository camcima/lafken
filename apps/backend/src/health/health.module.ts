import { Module } from "@nestjs/common";
import { HealthIndicatorService, TerminusModule } from "@nestjs/terminus";

import { AppLoggerPort } from "../shared/application/app-logger.port";
import { LoggerModule } from "../shared/infrastructure/logger/logger.module";
import { DatabaseClient } from "../shared/infrastructure/persistence/database-client";
import { DatabaseModule } from "../shared/infrastructure/persistence/database.module";
import { ApiHealthController } from "./presentation/api-health.controller";
import { DatabaseHealthIndicator } from "./presentation/indicators/database-health.indicator";

@Module({
  imports: [LoggerModule, DatabaseModule, TerminusModule],
  providers: [
    {
      provide: DatabaseHealthIndicator,
      inject: [AppLoggerPort, DatabaseClient, HealthIndicatorService],
      useFactory: (
        appLogger: AppLoggerPort,
        databaseClient: DatabaseClient,
        healthIndicatorService: HealthIndicatorService,
      ) => {
        appLogger.setContext(DatabaseHealthIndicator.name);

        return new DatabaseHealthIndicator(appLogger, databaseClient, healthIndicatorService);
      },
    },
  ],
  controllers: [ApiHealthController],
})
export class HealthModule {}
