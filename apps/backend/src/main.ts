// NOTE: This must be called before everything else
import "./shared/infrastructure/telemetry/register";

import { Logger as NestLogger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";

import { AppModule } from "./app.module";
import { setupApp } from "./setup-main-app";
import { environmentConfiguration } from "./shared/infrastructure/environment.configuration";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    abortOnError: false,
  });

  setupApp(app);

  await app.listen(environmentConfiguration.APP_PORT);
}

bootstrap().catch((err) => {
  const logger = new NestLogger("bootstrap");
  const errorToDisplay = new Error("Failed to start application", {
    cause: err,
  });
  logger.fatal(errorToDisplay);

  NestLogger.flush();

  process.exit(1);
});
