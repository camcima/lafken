import { Module } from "@nestjs/common";

import { environmentConfiguration } from "@/shared/infrastructure/environment.configuration";
import { LoggerModule } from "@/shared/infrastructure/logger/logger.module";
import { SystemInfrastructureModule } from "@/system/infrastructure/system-infrastructure.module";

import { ProcessClaimedAssetUseCase } from "./application/processing/process-claimed-asset.use-case";
import { ProcessingRetryPolicy } from "./application/processing/processing-retry-policy";
import { ProcessingWorkerService } from "./application/processing/processing-worker.service";
import { ReclaimStaleProcessingJobsUseCase } from "./application/processing/reclaim-stale-processing-jobs.use-case";
import { AssetsInfrastructureModule } from "./infrastructure/assets-infrastructure.module";

@Module({
  imports: [LoggerModule, AssetsInfrastructureModule, SystemInfrastructureModule],
  providers: [
    ProcessClaimedAssetUseCase,
    ProcessingWorkerService,
    ReclaimStaleProcessingJobsUseCase,
    {
      provide: ProcessingRetryPolicy,
      useFactory: (): ProcessingRetryPolicy =>
        new ProcessingRetryPolicy({
          maxAttempts: environmentConfiguration.PROCESSING_WORKER_MAX_ATTEMPTS,
          initialBackoffMs: environmentConfiguration.PROCESSING_WORKER_INITIAL_BACKOFF_MS,
          backoffMultiplier: environmentConfiguration.PROCESSING_WORKER_BACKOFF_MULTIPLIER,
          maxBackoffMs: environmentConfiguration.PROCESSING_WORKER_MAX_BACKOFF_MS,
        }),
    },
  ],
})
export class AssetsProcessingWorkerModule {}
