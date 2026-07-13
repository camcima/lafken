import { Injectable } from "@nestjs/common";
import type { Kysely, Transaction } from "kysely";

import type { ProcessingJob } from "@/assets/domain/entities/processing-job.entity";
import {
  type ICancelJobForAssetInput,
  type IClaimJobsInput,
  type ICountDueJobsInput,
  type IFindStaleClaimsInput,
  type IHeartbeatInput,
  type IMarkTerminalJobInput,
  type IReleaseForRetryInput,
  type IReleaseStaleClaimInput,
  ProcessingJobRepositoryPort,
} from "@/assets/domain/repositories/processing-job.repository.port";
import { ConnectionResolver } from "@/shared/infrastructure/persistence/connection-resolver";
import { DatabaseClient } from "@/shared/infrastructure/persistence/database-client";
import type { DB } from "@/shared/infrastructure/persistence/db.types";

import { ProcessingJobDbMapper } from "../mappers/processing-job.db-mapper";

interface IUpdateResultLike {
  numUpdatedRows: bigint;
}

const ZERO_UPDATED_ROWS = 0n;

@Injectable()
export class ProcessingJobRepository extends ProcessingJobRepositoryPort {
  constructor(
    private readonly db: DatabaseClient,
    private readonly resolver: ConnectionResolver,
  ) {
    super();
  }

  async claimAvailable(input: IClaimJobsInput): Promise<ProcessingJob[]> {
    const conn = this.resolver.resolve();
    const isAlreadyInTx = conn !== this.db.connection;

    const work = async (tx: Kysely<DB> | Transaction<DB>): Promise<ProcessingJob[]> => {
      const selected = await tx
        .selectFrom("processing_jobs")
        .selectAll()
        .where("state", "=", "released")
        .where((eb) => eb.or([eb("not_before", "is", null), eb("not_before", "<=", input.now)]))
        .orderBy("not_before", "asc")
        .orderBy("created_at", "asc")
        .forUpdate()
        .skipLocked()
        .limit(input.limit)
        .execute();

      const assetIds: string[] = selected.map((row): string => row.asset_id);
      if (assetIds.length === 0) {
        return [];
      }

      await tx
        .updateTable("processing_jobs")
        .set({
          state: "claimed",
          worker_id: input.workerId,
          claimed_at: input.now,
          heartbeat_at: input.now,
          current_step: "claim",
        })
        .where("asset_id", "in", assetIds)
        .execute();

      const rows = await tx
        .selectFrom("processing_jobs")
        .selectAll()
        .where("asset_id", "in", assetIds)
        .orderBy("created_at", "asc")
        .execute();

      return rows.map((row): ProcessingJob => ProcessingJobDbMapper.toDomain(row));
    };

    if (isAlreadyInTx) {
      return work(conn);
    }
    return this.db.connection.transaction().execute(work);
  }

  async heartbeat(input: IHeartbeatInput): Promise<boolean> {
    const result = await this.resolver
      .resolve()
      .updateTable("processing_jobs")
      .set({ heartbeat_at: input.now })
      .where("asset_id", "=", input.assetId)
      .where("worker_id", "=", input.workerId)
      .where("state", "=", "claimed")
      .executeTakeFirst();
    return this.hasUpdatedRows(result);
  }

  async updateCurrentStep(input: IHeartbeatInput & { currentStep: string }): Promise<boolean> {
    const result = await this.resolver
      .resolve()
      .updateTable("processing_jobs")
      .set({ current_step: input.currentStep, heartbeat_at: input.now })
      .where("asset_id", "=", input.assetId)
      .where("worker_id", "=", input.workerId)
      .where("state", "=", "claimed")
      .executeTakeFirst();
    return this.hasUpdatedRows(result);
  }

  async releaseForRetry(input: IReleaseForRetryInput): Promise<boolean> {
    const result = await this.resolver
      .resolve()
      .updateTable("processing_jobs")
      .set({
        state: "released",
        worker_id: null,
        claimed_at: null,
        heartbeat_at: null,
        current_step: null,
        attempt_number: input.attemptNumber,
        not_before: input.notBefore,
        last_error: input.lastError,
        last_error_at: input.now,
      })
      .where("asset_id", "=", input.assetId)
      .where("worker_id", "=", input.workerId)
      .where("state", "=", "claimed")
      .executeTakeFirst();
    return this.hasUpdatedRows(result);
  }

  async markCompleted(input: IMarkTerminalJobInput): Promise<boolean> {
    return this.markTerminal(input, "completed");
  }

  async markFailed(input: IMarkTerminalJobInput): Promise<boolean> {
    return this.markTerminal(input, "failed");
  }

  async findStaleClaims(input: IFindStaleClaimsInput): Promise<ProcessingJob[]> {
    const rows = await this.resolver
      .resolve()
      .selectFrom("processing_jobs")
      .selectAll()
      .where("state", "=", "claimed")
      .where("heartbeat_at", "<", input.staleBefore)
      .orderBy("heartbeat_at", "asc")
      .limit(input.limit)
      .execute();
    return rows.map((row): ProcessingJob => ProcessingJobDbMapper.toDomain(row));
  }

  async countDueJobs(input: ICountDueJobsInput): Promise<number> {
    // Mirrors claimAvailable's selection predicate (released or claimed jobs
    // whose not_before has elapsed). Used for the
    // `lafken.processing.queue_depth` observable gauge.
    const row = await this.resolver
      .resolve()
      .selectFrom("processing_jobs")
      .select((eb) => eb.fn.countAll<string>().as("count"))
      .where("state", "in", ["released", "claimed"])
      .where((eb) => eb.or([eb("not_before", "is", null), eb("not_before", "<=", input.now)]))
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }

  async releaseStaleClaim(input: IReleaseStaleClaimInput): Promise<boolean> {
    const result = await this.resolver
      .resolve()
      .updateTable("processing_jobs")
      .set({
        state: "released",
        worker_id: null,
        claimed_at: null,
        heartbeat_at: null,
        current_step: null,
        attempt_number: input.nextAttemptNumber,
        not_before: input.now,
        last_error: "stale_worker_claim",
        last_error_at: input.now,
      })
      .where("asset_id", "=", input.assetId)
      .where("state", "=", "claimed")
      .executeTakeFirst();
    return this.hasUpdatedRows(result);
  }

  async cancelForAsset(input: ICancelJobForAssetInput): Promise<boolean> {
    const result = await this.resolver
      .resolve()
      .updateTable("processing_jobs")
      .set({
        state: "completed",
        worker_id: null,
        claimed_at: null,
        heartbeat_at: input.now,
        current_step: null,
        not_before: null,
        last_error: input.reason,
        last_error_at: input.now,
      })
      .where("asset_id", "=", input.assetId)
      .where("state", "in", ["released", "claimed"])
      .executeTakeFirst();
    return this.hasUpdatedRows(result);
  }

  private async markTerminal(input: IMarkTerminalJobInput, state: string): Promise<boolean> {
    const result = await this.resolver
      .resolve()
      .updateTable("processing_jobs")
      .set({
        state,
        worker_id: null,
        current_step: null,
        heartbeat_at: input.now,
        last_error: input.lastError ?? null,
        last_error_at: input.lastError ? input.now : null,
      })
      .where("asset_id", "=", input.assetId)
      .where("worker_id", "=", input.workerId)
      .where("state", "=", "claimed")
      .executeTakeFirst();
    return this.hasUpdatedRows(result);
  }

  private hasUpdatedRows(result: IUpdateResultLike): boolean {
    return result.numUpdatedRows > ZERO_UPDATED_ROWS;
  }
}
