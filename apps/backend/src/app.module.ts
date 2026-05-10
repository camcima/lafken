import { Rfc9457Module } from "@camcima/nestjs-rfc9457";
import type { ProblemDetail, Rfc9457Request } from "@camcima/nestjs-rfc9457";
import {
  HttpException,
  HttpStatus,
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from "@nestjs/common";
import { APP_PIPE } from "@nestjs/core";

import { AssetsModule } from "./assets/assets.module";
import { AuditModule } from "./audit/audit.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { HealthModule } from "./health/health.module";
import { LegalHoldsModule } from "./legal-holds/legal-holds.module";
import { NamespacesModule } from "./namespaces/namespaces.module";
import { QuarantineModule } from "./quarantine/quarantine.module";
import { AppLoggerPort } from "./shared/application/app-logger.port";
import { environmentConfiguration } from "./shared/infrastructure/environment.configuration";
import { LoggerModule } from "./shared/infrastructure/logger/logger.module";
import { isDatabaseError } from "./shared/infrastructure/persistence/database-error";
import { ApiMetricsMiddleware } from "./shared/infrastructure/telemetry/api-metrics.middleware";
import { TelemetryModule } from "./shared/infrastructure/telemetry/telemetry.module";
import { DomainError } from "./shared/kernel/domain/errors/domain-error.interface";
import { ValidationError } from "./shared/kernel/domain/errors/validation-error.interface";
import { ApiInputValidationPipe } from "./shared/presentation/api-input-validation.pipe";
import { AuthModule } from "./shared/presentation/auth/auth.module";
import { JsonBodyParserMiddleware } from "./shared/presentation/middlewares/json-body-parser.middleware";
import { UrlEncodedParserMiddleware } from "./shared/presentation/middlewares/url-encoded-parser.middleware";
import { SystemModule } from "./system/system.module";

// Base URI for RFC 9457 problem type URIs — referenced in both typeBaseUri and appErrorBody.
const PROBLEM_BASE_URI = "https://lafken.dev/problems";

function kebabCase(value: string): string {
  return value
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2") // split run-of-caps before next word
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2") // split lower→Upper boundary
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

function appErrorBody(exception: DomainError | ValidationError, status: number): ProblemDetail {
  return {
    type: `${PROBLEM_BASE_URI}/${kebabCase(exception.errorCode)}`,
    title: exception.name,
    status,
    detail: exception.message,
    code: exception.errorCode,
    params: exception.params,
  };
}

@Module({
  imports: [
    LoggerModule,
    TelemetryModule,
    HealthModule,
    AuthModule,
    NamespacesModule,
    AssetsModule,
    QuarantineModule,
    LegalHoldsModule,
    AuditModule,
    SystemModule,
    DashboardModule,
    Rfc9457Module.forRootAsync({
      imports: [LoggerModule],
      inject: [AppLoggerPort],
      useFactory: (logger: AppLoggerPort) => ({
        catchAllExceptions: true,
        typeBaseUri: PROBLEM_BASE_URI,
        instanceStrategy: "none",
        onUnhandled: (exception: unknown, request: Rfc9457Request): void => {
          logger.error(
            {
              err: exception,
              path: request?.url,
              method: request?.method,
            },
            "Unhandled exception caught by RFC 9457 filter",
          );
        },
        exceptionMapper: (exception: unknown): ProblemDetail | null => {
          // Cause-unwrap: HttpException wrapping a DomainError/ValidationError keeps
          // the wrapper's HTTP status but emits the cause's domain identity.
          if (exception instanceof HttpException) {
            const cause = exception.cause;
            if (cause instanceof DomainError || cause instanceof ValidationError) {
              return appErrorBody(cause, exception.getStatus());
            }
            // For HttpExceptions with no domain cause, force `type: "about:blank"`
            // so we don't accidentally produce typed URIs from typeBaseUri.
            return {
              type: "about:blank",
              title: exception.name,
              status: exception.getStatus(),
              detail: exception.message,
            };
          }
          if (exception instanceof DomainError) {
            return appErrorBody(exception, HttpStatus.UNPROCESSABLE_ENTITY);
          }
          if (exception instanceof ValidationError) {
            return appErrorBody(exception, HttpStatus.BAD_REQUEST);
          }
          if (isDatabaseError(exception)) {
            const isDev = environmentConfiguration.NODE_ENV === "development";
            return {
              type: "about:blank",
              title: "Internal Server Error",
              status: 500,
              detail: isDev ? exception.message : undefined,
            };
          }
          return null; // library default for everything else
        },
      }),
    }),
  ],
  providers: [
    {
      provide: APP_PIPE,
      useClass: ApiInputValidationPipe,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(ApiMetricsMiddleware, JsonBodyParserMiddleware, UrlEncodedParserMiddleware)
      .forRoutes("*");
  }
}
