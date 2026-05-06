import { Injectable } from "@nestjs/common";

import type { ProcessingJob } from "@/assets/domain/entities/processing-job.entity";
import { AssetProcessingRepositoryPort } from "@/assets/domain/repositories/asset-processing.repository.port";
import { ProcessingJobRepositoryPort } from "@/assets/domain/repositories/processing-job.repository.port";
import { environmentConfiguration } from "@/shared/infrastructure/environment.configuration";

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
  ) {}

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
      await this.jobs.markCompleted({
        assetId: job.props.assetId,
        workerId,
        now,
      });
      return;
    }

    const nextAttemptNumber: number = job.props.attemptNumber + NEXT_ATTEMPT_INCREMENT;
    if (nextAttemptNumber > environmentConfiguration.PROCESSING_WORKER_MAX_ATTEMPTS) {
      await this.assets.transitionAsset({
        assetId: job.props.assetId,
        fromState: loaded.asset.props.state,
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
      await this.jobs.markFailed({
        assetId: job.props.assetId,
        workerId,
        lastError: "stale claim retry budget exhausted",
        now,
      });
      return;
    }

    await this.jobs.releaseStaleClaim({
      assetId: job.props.assetId,
      nextAttemptNumber,
      now,
    });
  }
}
