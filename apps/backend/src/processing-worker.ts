import "./shared/infrastructure/telemetry/register";

import { type INestApplicationContext, Logger as NestLogger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { ProcessingWorkerService } from "./assets/application/processing/processing-worker.service";
import { AssetsProcessingWorkerModule } from "./assets/assets-processing-worker.module";

async function bootstrap(): Promise<void> {
  const app: INestApplicationContext = await NestFactory.createApplicationContext(
    AssetsProcessingWorkerModule,
    {
      bufferLogs: true,
      abortOnError: false,
    },
  );

  const worker: ProcessingWorkerService = app.get(ProcessingWorkerService);
  worker.start();

  const shutdown = async (): Promise<void> => {
    worker.beginShutdown();
    await app.close();
  };

  process.once("SIGTERM", (): void => void shutdown());
  process.once("SIGINT", (): void => void shutdown());
}

bootstrap().catch((err: unknown): never => {
  const logger = new NestLogger("processing-worker");
  logger.fatal(new Error("Failed to start processing worker", { cause: err }));
  NestLogger.flush();
  process.exit(1);
});
