import { VersioningType } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Logger } from "nestjs-pino";

import { environmentConfiguration } from "./shared/infrastructure/environment.configuration";
import { loadSwaggerForNestjsApp } from "./shared/presentation/documentation/open-api-loader";

/**
 * Configures the given `NestExpressApplication` instance with the necessary
 * global settings such as logging, shutdown hooks, versioning, CORS, etc.
 */
export function setupApp(app: NestExpressApplication): void {
  app.set("query parser", "extended");

  app.useLogger(app.get(Logger));

  app.enableShutdownHooks();

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: "1",
    prefix: "v",
  });

  app.disable("x-powered-by");

  const allowedOrigins = environmentConfiguration.CORS_ALLOWED_ORIGINS;
  if (allowedOrigins.length > 0) {
    app.enableCors({
      origin: allowedOrigins.includes("*") ? true : allowedOrigins,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    });
  }

  app.disable("etag");

  loadSwaggerForNestjsApp(app);
}
