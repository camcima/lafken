import { randomUUID } from "node:crypto";

import { Inject, Injectable, type OnModuleDestroy, Optional } from "@nestjs/common";

import type { ProcessingJob } from "@/assets/domain/entities/processing-job.entity";
import { AssetProcessingRepositoryPort } from "@/assets/domain/repositories/asset-processing.repository.port";
import { ProcessingJobRepositoryPort } from "@/assets/domain/repositories/processing-job.repository.port";
import { AppLoggerPort } from "@/shared/application/app-logger.port";
import { MetricsPort } from "@/shared/application/metrics.port";

import { OrphanUploadIntentSweeperUseCase } from "./orphan-upload-intent-sweeper.use-case";
import { ProcessClaimedAssetUseCase } from "./process-claimed-asset.use-case";
import { makeTransitionMetadata } from "./processing-evidence";
import { ProcessingRetryPolicy, type RetryDecision } from "./processing-retry-policy";
import { ReclaimStaleProcessingJobsUseCase } from "./reclaim-stale-processing-jobs.use-case";
import { TransientProcessingError } from "./transient-processing.error";
import {
  type IWorkerRuntimeOptions,
  WorkerRuntimeOptionsPort,
} from "./worker-runtime-options.port";

const ZERO_REMAINING_CAPACITY = 0;

export interface IProcessClaimedAssetProcessor {
  execute(input: { assetId: string; workerId: string; attemptNumber: number }): Promise<unknown>;
}

interface IInFlightEntry {
  promise: Promise<void>;
  attemptNumber: number;
}

@Injectable()
export class ProcessingWorkerService implements OnModuleDestroy {
  readonly workerId: string = `worker-${randomUUID()}`;
  private readonly inFlight: Map<string, IInFlightEntry> = new Map();
  private shutdownStarted = false;
  private isClaiming = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private sweeperTimer: NodeJS.Timeout | null = null;
  private orphanSweepTimer: NodeJS.Timeout | null = null;
  private readonly opts: IWorkerRuntimeOptions;

  constructor(
    private readonly jobs: ProcessingJobRepositoryPort,
    @Inject(ProcessClaimedAssetUseCase)
    private readonly processor: IProcessClaimedAssetProcessor,
    private readonly retryPolicy: ProcessingRetryPolicy,
    private readonly assets: AssetProcessingRepositoryPort,
    private readonly logger: AppLoggerPort,
    private readonly metrics: MetricsPort,
    private readonly workerOptions: WorkerRuntimeOptionsPort,
    @Optional()
    private readonly reclaimer?: ReclaimStaleProcessingJobsUseCase,
    @Optional()
    private readonly orphanSweeper?: OrphanUploadIntentSweeperUseCase,
  ) {
    this.logger.setContext(ProcessingWorkerService.name);
    this.opts = this.workerOptions.get();
  }

  /**
   * Registers the `lafken.processing.queue_depth` observable gauge sampler via
   * `MetricsPort`. The sampler is registered exactly once across the lifetime of
   * the worker, even if `start()` is invoked more than once, so we don't
   * double-observe the gauge under restart paths.
   */
  registerQueueDepthCallback(): void {
    this.metrics.registerQueueDepthSampler(async (): Promise<number> => {
      return this.jobs.countDueJobs({ now: new Date() });
    });
  }

  start(): void {
    this.registerQueueDepthCallback();
    this.pollTimer = setInterval((): void => void this.tick(), this.opts.pollIntervalMs);
    this.heartbeatTimer = setInterval(
      (): void => void this.heartbeat(),
      this.opts.heartbeatIntervalMs,
    );
    if (this.reclaimer) {
      this.sweeperTimer = setInterval((): void => {
        this.reclaimer?.execute({ now: new Date() }).catch((err: unknown): void => {
          this.logger.error(
            { loop: "stale-claim-sweeper", err: this.errorMessage(err) },
            "stale-claim sweep iteration failed; retrying on next interval",
          );
        });
      }, this.opts.staleClaimMs);
    }
    if (this.orphanSweeper) {
      this.orphanSweepTimer = setInterval((): void => {
        this.orphanSweeper
          ?.execute({
            now: new Date(),
            graceMs: this.opts.orphanIntentGraceMs,
            batchSize: 100,
          })
          .catch((err: unknown): void => {
            this.logger.error(
              { loop: "orphan-intent-sweeper", err: this.errorMessage(err) },
              "orphan-intent sweep iteration failed; retrying on next interval",
            );
          });
      }, this.opts.orphanIntentSweepIntervalMs);
    }
    void this.tick();
  }

  async tick(): Promise<void> {
    if (this.shutdownStarted) {
      return;
    }
    // Re-entrancy guard: if the previous tick's claim query outlives the poll
    // interval, a second overlapping tick could exceed the concurrency cap.
    if (this.isClaiming) {
      return;
    }

    const remaining: number = this.opts.concurrency - this.inFlight.size;
    if (remaining <= ZERO_REMAINING_CAPACITY) {
      return;
    }

    this.isClaiming = true;
    let jobs: ProcessingJob[];
    try {
      jobs = await this.jobs.claimAvailable({
        workerId: this.workerId,
        limit: remaining,
        now: new Date(),
      });
    } catch (err) {
      // Crash guard (F-P2): a transient DB error in the poll loop must never
      // become an unhandled rejection that kills the worker process.
      this.logger.error(
        { loop: "tick", err: this.errorMessage(err) },
        "tick failed to claim jobs; retrying on next poll",
      );
      return;
    } finally {
      this.isClaiming = false;
    }

    this.logger.debug({ claimed: jobs.length, inFlight: this.inFlight.size }, "tick claimed jobs");

    for (const job of jobs) {
      this.metrics.recordProcessingJobClaimed();
      const promise: Promise<void> = this.process(job.props.assetId, job.props.attemptNumber);
      this.inFlight.set(job.props.assetId, { promise, attemptNumber: job.props.attemptNumber });
      promise
        .catch((err: unknown): void => {
          // Defensive net: process() handles its own retries and terminal
          // marking, so this branch should be unreachable in practice. If we
          // do land here, surface it loudly so the bug doesn't get lost.
          this.logger.error(
            { assetId: job.props.assetId, err: this.errorMessage(err) },
            "processing crashed without graceful retry handling",
          );
        })
        .finally((): void => {
          this.inFlight.delete(job.props.assetId);
        });
    }
  }

  async heartbeat(): Promise<void> {
    const assetIds: string[] = Array.from(this.inFlight.keys());
    const results: PromiseSettledResult<void>[] = await Promise.allSettled(
      assetIds.map(async (assetId: string): Promise<void> => {
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
    results.forEach((result: PromiseSettledResult<void>, index: number): void => {
      if (result.status === "rejected") {
        this.logger.error(
          { loop: "heartbeat", assetId: assetIds[index], err: this.errorMessage(result.reason) },
          "heartbeat write failed; job may be reclaimed by the stale sweeper",
        );
      }
    });
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
    if (this.orphanSweepTimer) {
      clearInterval(this.orphanSweepTimer);
    }
  }

  trackInFlight(assetId: string, attemptNumber = 1, promise?: Promise<void>): void {
    this.inFlight.set(assetId, { promise: promise ?? Promise.resolve(), attemptNumber });
  }

  /**
   * Awaits all currently in-flight processing promises. Used by tests and by
   * the shutdown path; not part of the steady-state worker loop.
   */
  async drainInFlight(): Promise<void> {
    await Promise.allSettled(Array.from(this.inFlight.values()).map((entry) => entry.promise));
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.info({ workerId: this.workerId }, "graceful shutdown starting");
    this.beginShutdown();
    const inFlightPromises: Promise<void>[] = Array.from(this.inFlight.values()).map(
      (entry) => entry.promise,
    );
    await Promise.race([
      Promise.allSettled(inFlightPromises),
      new Promise<void>((resolve): void => {
        setTimeout(resolve, this.opts.shutdownGraceMs);
      }),
    ]);
    // After the grace race: any assets still in-flight got cut off. Release
    // them so a subsequent worker can claim immediately, instead of waiting
    // for the stale sweeper.
    if (this.inFlight.size > 0) {
      const entries: Array<[string, IInFlightEntry]> = Array.from(this.inFlight.entries());
      this.logger.warn(
        { assetIds: entries.map(([assetId]): string => assetId) },
        "shutdown grace expired with in-flight jobs; releasing for immediate retry",
      );
      const now: Date = new Date();
      await Promise.all(
        entries.map(async ([assetId, entry]): Promise<void> => {
          const released: boolean = await this.jobs.releaseForRetry({
            assetId,
            workerId: this.workerId,
            notBefore: now,
            // Don't consume a retry slot — we didn't count this as a real
            // failed attempt. The next worker resumes the same attemptNumber.
            attemptNumber: entry.attemptNumber,
            lastError: "worker_shutdown",
            now,
          });
          if (released) {
            this.metrics.recordProcessingJobReleased({ reason: "worker_shutdown" });
          } else {
            this.logger.warn(
              { assetId },
              "shutdown release lost race; another worker may already own this job",
            );
          }
        }),
      );
    }
  }

  private async process(assetId: string, attemptNumber: number): Promise<void> {
    let timeoutHandle: NodeJS.Timeout | null = null;
    let timedOut = false;
    const timeoutPromise: Promise<"timeout"> = new Promise((resolve): void => {
      timeoutHandle = setTimeout((): void => {
        timedOut = true;
        resolve("timeout");
      }, this.opts.workflowTimeoutMs);
    });

    try {
      const winner: "completed" | "timeout" = await Promise.race([
        this.processor
          .execute({ assetId, workerId: this.workerId, attemptNumber })
          .then((): "completed" => "completed"),
        timeoutPromise,
      ]).catch((err: unknown): never => {
        // Re-throw; caught below to drive retry classification.
        throw err;
      });

      if (winner === "timeout") {
        this.logger.error(
          { assetId, attemptNumber, timeoutMs: this.opts.workflowTimeoutMs },
          "workflow timeout reached; marking processing_failed",
        );
        this.metrics.recordProcessingWorkflowTimeout();
        await this.markFailed(assetId, attemptNumber, "workflow_timeout", "workflow_timeout");
        return;
      }
    } catch (err) {
      if (timedOut) {
        return; // already handled above
      }
      const lastError: string = this.errorMessage(err);

      if (!(err instanceof TransientProcessingError)) {
        this.logger.error(
          { assetId, attemptNumber, err: lastError },
          "permanent processing error; marking failed without retry",
        );
        this.metrics.recordProcessingRetry({ errorClass: "permanent" });
        await this.markFailed(assetId, attemptNumber, "permanent_error", lastError);
        return;
      }

      this.metrics.recordProcessingRetry({ errorClass: "transient" });
      const decision: RetryDecision = this.retryPolicy.nextRetry({ attemptNumber });
      if (decision.kind === "exhausted") {
        this.logger.error(
          { assetId, attemptNumber, err: lastError },
          "retry budget exhausted; marking job failed",
        );
        await this.markFailed(assetId, attemptNumber, "retry_budget_exhausted", lastError);
        return;
      }

      const notBefore: Date = new Date(Date.now() + decision.delayMs);
      const released: boolean = await this.jobs.releaseForRetry({
        assetId,
        workerId: this.workerId,
        notBefore,
        attemptNumber: decision.nextAttemptNumber,
        lastError,
        now: new Date(),
      });
      if (released) {
        this.metrics.recordProcessingJobReleased({ reason: "transient_error" });
      } else {
        this.logger.warn(
          { assetId, attemptNumber },
          "releaseForRetry lost race; another worker may own this job",
        );
      }
    } finally {
      if (timeoutHandle !== null) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  private async markFailed(
    assetId: string,
    attemptNumber: number,
    reason: string,
    lastError: string,
  ): Promise<void> {
    const now: Date = new Date();
    const transitioned: boolean = await this.assets.transitionAsset({
      assetId,
      fromState: "processing",
      toState: "processing_failed",
      reason,
      metadata: makeTransitionMetadata({
        workerId: this.workerId,
        attemptNumber,
        reasonCode: reason,
      }),
      occurredBy: `worker:${this.workerId}`,
      now,
    });
    if (transitioned) {
      this.metrics.recordProcessingTerminalState({ state: "processing_failed" });
    } else {
      this.logger.warn(
        { assetId, attemptNumber, reason },
        "asset was not in 'processing' when marking failed; another actor moved it",
      );
    }
    await this.jobs.markFailed({ assetId, workerId: this.workerId, lastError, now });
  }

  private errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
