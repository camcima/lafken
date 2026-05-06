import { ProcessingJob } from "@/assets/domain/entities/processing-job.entity";
import type { ProcessingJobState } from "@/assets/domain/value-objects/processing-job-state.value-object";

export class ProcessingJobDbMapper {
  static toDomain(row: Record<string, any>): ProcessingJob {
    return ProcessingJob.fromProps({
      assetId: row["asset_id"] as string,
      state: row["state"] as ProcessingJobState,
      workerId: (row["worker_id"] as string | null) ?? null,
      currentStep: (row["current_step"] as string | null) ?? null,
      attemptNumber: row["attempt_number"] as number,
      notBefore: row["not_before"] ? new Date(row["not_before"] as string) : null,
      claimedAt: row["claimed_at"] ? new Date(row["claimed_at"] as string) : null,
      heartbeatAt: row["heartbeat_at"] ? new Date(row["heartbeat_at"] as string) : null,
      lastError: (row["last_error"] as string | null) ?? null,
      lastErrorAt: row["last_error_at"] ? new Date(row["last_error_at"] as string) : null,
      createdAt: new Date(row["created_at"] as string),
      updatedAt: new Date(row["updated_at"] as string),
    });
  }
}
