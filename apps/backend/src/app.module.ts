import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { APP_FILTER, APP_PIPE } from "@nestjs/core";

import { HealthModule } from "./health/health.module";
import { LoggerModule } from "./shared/infrastructure/logger/logger.module";
import { TelemetryModule } from "./shared/infrastructure/telemetry/telemetry.module";
import { ApiInputValidationPipe } from "./shared/presentation/api-input-validation.pipe";
import { AuthModule } from "./shared/presentation/auth/auth.module";
import { CatchAllExceptionsForHttp } from "./shared/presentation/middlewares/catch-all-exceptions.filter";
import { JsonBodyParserMiddleware } from "./shared/presentation/middlewares/json-body-parser.middleware";
import { UrlEncodedParserMiddleware } from "./shared/presentation/middlewares/url-encoded-parser.middleware";

@Module({
  imports: [LoggerModule, TelemetryModule, HealthModule, AuthModule],
  providers: [
    {
      provide: APP_PIPE,
      useClass: ApiInputValidationPipe,
    },
    {
      provide: APP_FILTER,
      useClass: CatchAllExceptionsForHttp,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(JsonBodyParserMiddleware, UrlEncodedParserMiddleware).forRoutes("*");
  }
}
