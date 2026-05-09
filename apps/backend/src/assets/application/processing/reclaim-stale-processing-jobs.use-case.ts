import { Injectable } from "@nestjs/common";

import type { ProcessingJob } from "@/assets/domain/entities/processing-job.entity";
import { AssetProcessingRepositoryPort } from "@/assets/domain/repositories/asset-processing.repository.port";
import { ProcessingJobRepositoryPort } from "@/assets/domain/repositories/processing-job.repository.port";
import { AppLoggerPort } from "@/shared/application/app-logger.port";
import { environmentConfiguration } from "@/shared/infrastructure/environment.configuration";
import {
  processingStaleClaimReclaimedCounter,
  processingTerminalStateCounter,
} from "@/shared/infrastructure/telemetry/metrics";

import { isTerminalAssetState, makeTransitionMetadata } from "./processing-evidence";

const STALE_CLAIM_LIMIT = 25;
const NEXT_ATTEMPT_INCREMENT = 1;
const STALE_SWEEPER_WORKER_ID = "stale-sweeper";

export interface IReclaimStaleProcessingJobsInput {
  now: Date;
}

@Injectable()
export class ReclaimStaleProcessingJobsUseCase {
  constructor(
    private readonly jobs: ProcessingJobRepositoryPort,
    private readonly assets: AssetProcessingRepositoryPort,
    private readonly logger: AppLoggerPort,
  ) {
    this.logger.setContext(ReclaimStaleProcessingJobsUseCase.name);
  }

  async execute(input: IReclaimStaleProcessingJobsInput): Promise<void> {
    const staleBefore: Date = new Date(
      input.now.getTime() - environmentConfiguration.PROCESSING_WORKER_STALE_CLAIM_MS,
    );
    const jobs: ProcessingJob[] = await this.jobs.findStaleClaims({
      staleBefore,
      limit: STALE_CLAIM_LIMIT,
    });

    for (const job of jobs) {
      await this.reclaimJob(job, input.now);
    }
  }

  private async reclaimJob(job: ProcessingJob, now: Date): Promise<void> {
    const loaded = await this.assets.findAssetWithPolicy(job.props.assetId);
    const workerId: string = job.props.workerId ?? STALE_SWEEPER_WORKER_ID;

    if (!loaded || isTerminalAssetState(loaded.asset.props.state)) {
      this.logger.info(
        {
          assetId: job.props.assetId,
          currentState: loaded?.asset.props.state ?? null,
          action: "completed_terminal",
        },
        "stale job for terminal asset; marking job completed",
      );
      const marked: boolean = await this.jobs.markCompleted({
        assetId: job.props.assetId,
        workerId,
        now,
      });
      if (!marked) {
        this.logger.warn(
          { assetId: job.props.assetId },
          "markCompleted lost race during stale-job reclaim",
        );
      }
      return;
    }

    const nextAttemptNumber: number = job.props.attemptNumber + NEXT_ATTEMPT_INCREMENT;
    if (nextAttemptNumber > environmentConfiguration.PROCESSING_WORKER_MAX_ATTEMPTS) {
      this.logger.info(
        {
          assetId: job.props.assetId,
          currentState: loaded.asset.props.state,
          action: "exhausted",
        },
        "stale job exceeded retry budget",
      );
      // Only transition the asset if it actually got into 'processing'. If the
      // worker died before the 'uploaded -> processing' transition ran, the
      // asset is still 'uploaded' and the only legal move from there is via
      // the normal pipeline. Just mark the job failed so it stops being
      // retried.
      if (loaded.asset.props.state === "processing") {
        const transitioned: boolean = await this.assets.transitionAsset({
          assetId: job.props.assetId,
          fromState: "processing",
          toState: "processing_failed",
          reason: "retry_budget_exhausted",
          metadata: makeTransitionMetadata({
            workerId: STALE_SWEEPER_WORKER_ID,
            attemptNumber: job.props.attemptNumber,
            reasonCode: "retry_budget_exhausted",
          }),
          occurredBy: `worker:${STALE_SWEEPER_WORKER_ID}`,
          now,
        });
        if (transitioned) {
          processingTerminalStateCounter.add(1, { state: "processing_failed" });
        } else {
          this.logger.warn(
            { assetId: job.props.assetId, currentState: loaded.asset.props.state },
            "reclaim transition lost race; skipping markFailed",
          );
          return;
        }
      } else {
        this.logger.warn(
          { assetId: job.props.assetId, currentState: loaded.asset.props.state },
          "reclaim found exhausted job whose asset is not in 'processing'; marking job failed without state transition",
        );
      }
      await this.jobs.markFailed({
        assetId: job.props.assetId,
        workerId,
        lastError: "stale claim retry budget exhausted",
        now,
      });
      return;
    }

    this.logger.info(
      {
        assetId: job.props.assetId,
        currentState: loaded.asset.props.state,
        action: "released",
        nextAttemptNumber,
      },
      "releasing stale claim for retry",
    );
    const released: boolean = await this.jobs.releaseStaleClaim({
      assetId: job.props.assetId,
      nextAttemptNumber,
      now,
    });
    if (released) {
      processingStaleClaimReclaimedCounter.add(1);
    } else {
      this.logger.warn(
        { assetId: job.props.assetId },
        "releaseStaleClaim lost race; another reclaimer beat us",
      );
    }
  }
}
