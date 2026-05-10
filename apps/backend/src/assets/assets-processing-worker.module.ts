import { Module } from "@nestjs/common";

import { AuditInfrastructureModule } from "@/audit/infrastructure/audit-infrastructure.module";
import { LoggerModule } from "@/shared/infrastructure/logger/logger.module";
import { TelemetryModule } from "@/shared/infrastructure/telemetry/telemetry.module";
import { SystemInfrastructureModule } from "@/system/infrastructure/system-infrastructure.module";

import { OrphanUploadIntentSweeperUseCase } from "./application/processing/orphan-upload-intent-sweeper.use-case";
import { ProcessClaimedAssetUseCase } from "./application/processing/process-claimed-asset.use-case";
import { ProcessingRetryPolicy } from "./application/processing/processing-retry-policy";
import { ProcessingWorkerService } from "./application/processing/processing-worker.service";
import { ReclaimStaleProcessingJobsUseCase } from "./application/processing/reclaim-stale-processing-jobs.use-case";
import {
  type IWorkerRuntimeOptions,
  WorkerRuntimeOptionsPort,
} from "./application/processing/worker-runtime-options.port";
import { AssetsInfrastructureModule } from "./infrastructure/assets-infrastructure.module";
import { EnvWorkerRuntimeOptions } from "./infrastructure/env-worker-runtime-options";

@Module({
  imports: [
    LoggerModule,
    TelemetryModule,
    AssetsInfrastructureModule,
    SystemInfrastructureModule,
    AuditInfrastructureModule,
  ],
  providers: [
    EnvWorkerRuntimeOptions,
    { provide: WorkerRuntimeOptionsPort, useExisting: EnvWorkerRuntimeOptions },
    ProcessClaimedAssetUseCase,
    ProcessingWorkerService,
    ReclaimStaleProcessingJobsUseCase,
    OrphanUploadIntentSweeperUseCase,
    {
      provide: ProcessingRetryPolicy,
      useFactory: (workerOptions: WorkerRuntimeOptionsPort): ProcessingRetryPolicy => {
        const opts: IWorkerRuntimeOptions = workerOptions.get();
        return new ProcessingRetryPolicy({
          maxAttempts: opts.maxAttempts,
          initialBackoffMs: opts.initialBackoffMs,
          backoffMultiplier: opts.backoffMultiplier,
          maxBackoffMs: opts.maxBackoffMs,
        });
      },
      inject: [WorkerRuntimeOptionsPort],
    },
  ],
})
export class AssetsProcessingWorkerModule {}
