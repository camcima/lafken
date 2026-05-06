import { ProcessingJobResponseDTO } from "@shared/backend-api";

import type { ProcessingJob } from "@/assets/domain/entities/processing-job.entity";

export class ProcessingJobResponseMapper {
  static fromDomain(job: ProcessingJob): ProcessingJobResponseDTO {
    return {
      state: job.props.state,
      workerId: job.props.workerId ?? undefined,
      currentStep: job.props.currentStep ?? undefined,
      attemptNumber: job.props.attemptNumber,
      notBefore: job.props.notBefore?.toISOString() ?? undefined,
      lastError: job.props.lastError ?? undefined,
      lastErrorAt: job.props.lastErrorAt?.toISOString() ?? undefined,
      heartbeatAt: job.props.heartbeatAt?.toISOString() ?? undefined,
      claimedAt: job.props.claimedAt?.toISOString() ?? undefined,
      createdAt: job.props.createdAt.toISOString(),
    };
  }
}
