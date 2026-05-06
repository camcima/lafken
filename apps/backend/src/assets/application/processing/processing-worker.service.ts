import { randomUUID } from "node:crypto";

import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";

import type { ProcessingJob } from "@/assets/domain/entities/processing-job.entity";
import { ProcessingJobRepositoryPort } from "@/assets/domain/repositories/processing-job.repository.port";
import { environmentConfiguration } from "@/shared/infrastructure/environment.configuration";

import { ProcessClaimedAssetUseCase } from "./process-claimed-asset.use-case";

const ZERO_REMAINING_CAPACITY = 0;

export interface IProcessClaimedAssetProcessor {
  execute(input: { assetId: string; workerId: string; attemptNumber: number }): Promise<unknown>;
}

@Injectable()
export class ProcessingWorkerService implements OnModuleDestroy {
  readonly workerId: string = `worker-${randomUUID()}`;
  private readonly inFlight: Map<string, Promise<void>> = new Map();
  private shutdownStarted = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly jobs: ProcessingJobRepositoryPort,
    @Inject(ProcessClaimedAssetUseCase)
    private readonly processor: IProcessClaimedAssetProcessor,
  ) {}

  start(): void {
    this.pollTimer = setInterval(
      (): void => void this.tick(),
      environmentConfiguration.PROCESSING_WORKER_POLL_INTERVAL_MS,
    );
    this.heartbeatTimer = setInterval(
      (): void => void this.heartbeat(),
      environmentConfiguration.PROCESSING_WORKER_HEARTBEAT_INTERVAL_MS,
    );
    void this.tick();
  }

  async tick(): Promise<void> {
    if (this.shutdownStarted) {
      return;
    }

    const remaining: number =
      environmentConfiguration.PROCESSING_WORKER_CONCURRENCY - this.inFlight.size;
    if (remaining <= ZERO_REMAINING_CAPACITY) {
      return;
    }

    const jobs: ProcessingJob[] = await this.jobs.claimAvailable({
      workerId: this.workerId,
      limit: remaining,
      now: new Date(),
    });

    for (const job of jobs) {
      const promise: Promise<void> = this.process(job.props.assetId, job.props.attemptNumber);
      this.inFlight.set(job.props.assetId, promise);
      promise
        .finally((): void => {
          this.inFlight.delete(job.props.assetId);
        })
        .catch((): undefined => undefined);
    }
  }

  async heartbeat(): Promise<void> {
    await Promise.all(
      Array.from(this.inFlight.keys()).map((assetId: string): Promise<boolean> => {
        return this.jobs.heartbeat({ assetId, workerId: this.workerId, now: new Date() });
      }),
    );
  }

  beginShutdown(): void {
    this.shutdownStarted = true;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
  }

  trackInFlight(assetId: string): void {
    this.inFlight.set(assetId, Promise.resolve());
  }

  async onModuleDestroy(): Promise<void> {
    this.beginShutdown();
    await Promise.race([
      Promise.allSettled(this.inFlight.values()),
      new Promise<void>((resolve): void => {
        setTimeout(resolve, environmentConfiguration.PROCESSING_WORKER_SHUTDOWN_GRACE_MS);
      }),
    ]);
  }

  private async process(assetId: string, attemptNumber: number): Promise<void> {
    await this.processor.execute({ assetId, workerId: this.workerId, attemptNumber });
  }
}
