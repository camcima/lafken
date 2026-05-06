import { randomUUID } from "node:crypto";

import { Inject, Injectable, type OnModuleDestroy, Optional } from "@nestjs/common";

import type { ProcessingJob } from "@/assets/domain/entities/processing-job.entity";
import { AssetProcessingRepositoryPort } from "@/assets/domain/repositories/asset-processing.repository.port";
import { ProcessingJobRepositoryPort } from "@/assets/domain/repositories/processing-job.repository.port";
import { AppLoggerPort } from "@/shared/application/app-logger.port";
import { environmentConfiguration } from "@/shared/infrastructure/environment.configuration";

import { ProcessClaimedAssetUseCase } from "./process-claimed-asset.use-case";
import { makeTransitionMetadata } from "./processing-evidence";
import { ProcessingRetryPolicy, type RetryDecision } from "./processing-retry-policy";
import { ReclaimStaleProcessingJobsUseCase } from "./reclaim-stale-processing-jobs.use-case";

const ZERO_REMAINING_CAPACITY = 0;
const SHUTDOWN_WAKEUP_INTERVAL_MS = 100;
const ZERO_FAILURE_COUNT = 0;
const FIRST_FAILURE_INCREMENT = 1;

export interface IProcessClaimedAssetProcessor {
  execute(input: { assetId: string; workerId: string; attemptNumber: number }): Promise<unknown>;
}

/**
 * Optional knobs used by tests to control sleep timing without juggling fake
 * timers. Production wiring leaves them unset and the service uses the real
 * `setTimeout`.
 */
export interface IProcessingWorkerOptions {
  sleep?: (ms: number) => Promise<void>;
}

@Injectable()
export class ProcessingWorkerService implements OnModuleDestroy {
  readonly workerId: string = `worker-${randomUUID()}`;
  private readonly inFlight: Map<string, Promise<void>> = new Map();
  private shutdownStarted = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private sweeperTimer: NodeJS.Timeout | null = null;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(
    private readonly jobs: ProcessingJobRepositoryPort,
    @Inject(ProcessClaimedAssetUseCase)
    private readonly processor: IProcessClaimedAssetProcessor,
    private readonly retryPolicy: ProcessingRetryPolicy,
    private readonly assets: AssetProcessingRepositoryPort,
    private readonly logger: AppLoggerPort,
    @Optional()
    private readonly reclaimer?: ReclaimStaleProcessingJobsUseCase,
    @Optional()
    @Inject("PROCESSING_WORKER_OPTIONS")
    options?: IProcessingWorkerOptions,
  ) {
    this.logger.setContext(ProcessingWorkerService.name);
    this.sleep = options?.sleep ?? this.defaultSleep.bind(this);
  }

  start(): void {
    this.pollTimer = setInterval(
      (): void => void this.tick(),
      environmentConfiguration.PROCESSING_WORKER_POLL_INTERVAL_MS,
    );
    this.heartbeatTimer = setInterval(
      (): void => void this.heartbeat(),
      environmentConfiguration.PROCESSING_WORKER_HEARTBEAT_INTERVAL_MS,
    );
    if (this.reclaimer) {
      this.sweeperTimer = setInterval(
        (): void => void this.reclaimer?.execute({ now: new Date() }),
        environmentConfiguration.PROCESSING_WORKER_STALE_CLAIM_MS,
      );
    }
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

    this.logger.debug({ claimed: jobs.length, inFlight: this.inFlight.size }, "tick claimed jobs");

    for (const job of jobs) {
      const promise: Promise<void> = this.process(job.props.assetId, job.props.attemptNumber);
      this.inFlight.set(job.props.assetId, promise);
      promise
        .catch((err: unknown): void => {
          // Defensive net: process() handles its own retries and terminal
          // marking, so this branch should be unreachable in practice. If we
          // do land here, surface it loudly so the bug doesn't get lost.
          const message: string = err instanceof Error ? err.message : String(err);
          this.logger.error(
            { assetId: job.props.assetId, err: message },
            "processing crashed without graceful retry handling",
          );
        })
        .finally((): void => {
          this.inFlight.delete(job.props.assetId);
        });
    }
  }

  async heartbeat(): Promise<void> {
    await Promise.all(
      Array.from(this.inFlight.keys()).map(async (assetId: string): Promise<void> => {
        const ok: boolean = await this.jobs.heartbeat({
          assetId,
          workerId: this.workerId,
          now: new Date(),
        });
        if (!ok) {
          this.logger.warn({ assetId }, "heartbeat failed; another worker may have taken the job");
        }
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
    if (this.sweeperTimer) {
      clearInterval(this.sweeperTimer);
    }
  }

  trackInFlight(assetId: string): void {
    this.inFlight.set(assetId, Promise.resolve());
  }

  /**
   * Awaits all currently in-flight processing promises. Used by tests and by
   * the shutdown path; not part of the steady-state worker loop.
   */
  async drainInFlight(): Promise<void> {
    await Promise.allSettled(Array.from(this.inFlight.values()));
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.info({ workerId: this.workerId }, "graceful shutdown starting");
    this.beginShutdown();
    await Promise.race([
      Promise.allSettled(this.inFlight.values()),
      new Promise<void>((resolve): void => {
        setTimeout(resolve, environmentConfiguration.PROCESSING_WORKER_SHUTDOWN_GRACE_MS);
      }),
    ]);
  }

  private async process(assetId: string, attemptNumber: number): Promise<void> {
    let failureCount: number = ZERO_FAILURE_COUNT;
    for (;;) {
      try {
        await this.processor.execute({ assetId, workerId: this.workerId, attemptNumber });
        return;
      } catch (err) {
        const decision: RetryDecision = this.retryPolicy.nextRetry({
          attemptNumber,
          failureCountInAttempt: failureCount,
        });
        failureCount += FIRST_FAILURE_INCREMENT;
        const lastError: string = err instanceof Error ? err.message : String(err);

        if (decision.kind === "in_memory") {
          this.logger.warn(
            {
              assetId,
              attemptNumber,
              failureCount,
              delayMs: decision.delayMs,
              err: lastError,
            },
            "processing step failed; retrying in-memory",
          );
          await this.sleep(decision.delayMs);
          if (this.shutdownStarted) {
            this.logger.info(
              { assetId, attemptNumber },
              "shutdown started during in-memory retry; aborting",
            );
            return;
          }
          continue;
        }

        if (decision.kind === "release") {
          this.logger.warn(
            {
              assetId,
              attemptNumber,
              nextAttemptNumber: decision.nextAttemptNumber,
              delayMs: decision.delayMs,
              err: lastError,
            },
            "in-memory retries exhausted; releasing for delayed retry",
          );
          const notBefore: Date = new Date(Date.now() + decision.delayMs);
          const released: boolean = await this.jobs.releaseForRetry({
            assetId,
            workerId: this.workerId,
            notBefore,
            attemptNumber: decision.nextAttemptNumber,
            lastError,
            now: new Date(),
          });
          if (!released) {
            this.logger.warn(
              { assetId, attemptNumber },
              "releaseForRetry lost race; another worker may own this job",
            );
          }
          return;
        }

        this.logger.error(
          { assetId, attemptNumber, err: lastError },
          "retry budget exhausted; marking job failed",
        );
        await this.markExhausted(assetId, attemptNumber, lastError);
        return;
      }
    }
  }

  private async markExhausted(
    assetId: string,
    attemptNumber: number,
    lastError: string,
  ): Promise<void> {
    const now: Date = new Date();
    const transitioned: boolean = await this.assets.transitionAsset({
      assetId,
      fromState: "processing",
      toState: "processing_failed",
      reason: "retry_budget_exhausted",
      metadata: makeTransitionMetadata({
        workerId: this.workerId,
        attemptNumber,
        reasonCode: "retry_budget_exhausted",
      }),
      occurredBy: `worker:${this.workerId}`,
      now,
    });
    if (!transitioned) {
      this.logger.warn(
        { assetId, attemptNumber },
        "asset was not in 'processing' when marking exhausted; another actor moved it",
      );
    }
    await this.jobs.markFailed({
      assetId,
      workerId: this.workerId,
      lastError,
      now,
    });
  }

  /**
   * Cancellable sleep. Wakes early if shutdown begins so we don't hold the
   * process open for the full retry delay during graceful shutdown.
   */
  private async defaultSleep(totalMs: number): Promise<void> {
    const deadline: number = Date.now() + totalMs;
    while (!this.shutdownStarted) {
      const remaining: number = deadline - Date.now();
      if (remaining <= 0) {
        return;
      }
      const chunk: number = Math.min(remaining, SHUTDOWN_WAKEUP_INTERVAL_MS);
      await new Promise<void>((resolve): void => {
        setTimeout(resolve, chunk);
      });
    }
  }
}
