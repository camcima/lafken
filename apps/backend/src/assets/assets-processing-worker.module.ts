import { Module } from "@nestjs/common";

import { environmentConfiguration } from "@/shared/infrastructure/environment.configuration";
import { LoggerModule } from "@/shared/infrastructure/logger/logger.module";
import { SystemInfrastructureModule } from "@/system/infrastructure/system-infrastructure.module";

import { ProcessClaimedAssetUseCase } from "./application/processing/process-claimed-asset.use-case";
import { ProcessingRetryPolicy } from "./application/processing/processing-retry-policy";
import { ProcessingWorkerService } from "./application/processing/processing-worker.service";
import { AssetsInfrastructureModule } from "./infrastructure/assets-infrastructure.module";

@Module({
  imports: [LoggerModule, AssetsInfrastructureModule, SystemInfrastructureModule],
  providers: [
    ProcessClaimedAssetUseCase,
    ProcessingWorkerService,
    {
      provide: ProcessingRetryPolicy,
      useFactory: (): ProcessingRetryPolicy =>
        new ProcessingRetryPolicy({
          maxAttempts: environmentConfiguration.PROCESSING_WORKER_MAX_ATTEMPTS,
        }),
    },
  ],
})
export class AssetsProcessingWorkerModule {}
