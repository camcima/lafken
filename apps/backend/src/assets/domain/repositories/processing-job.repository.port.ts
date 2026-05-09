import type { ProcessingJob } from "@/assets/domain/entities/processing-job.entity";

export interface IClaimJobsInput {
  workerId: string;
  limit: number;
  now: Date;
}

export interface IHeartbeatInput {
  assetId: string;
  workerId: string;
  now: Date;
}

export interface IReleaseForRetryInput {
  assetId: string;
  workerId: string;
  notBefore: Date;
  attemptNumber: number;
  lastError: string;
  now: Date;
}

export interface IMarkTerminalJobInput {
  assetId: string;
  workerId: string;
  lastError?: string;
  now: Date;
}

export interface IFindStaleClaimsInput {
  staleBefore: Date;
  limit: number;
}

export interface IReleaseStaleClaimInput {
  assetId: string;
  nextAttemptNumber: number;
  now: Date;
}

export interface ICountDueJobsInput {
  now: Date;
}

export abstract class ProcessingJobRepositoryPort {
  abstract claimAvailable(input: IClaimJobsInput): Promise<ProcessingJob[]>;
  abstract heartbeat(input: IHeartbeatInput): Promise<boolean>;
  abstract updateCurrentStep(input: IHeartbeatInput & { currentStep: string }): Promise<boolean>;
  abstract releaseForRetry(input: IReleaseForRetryInput): Promise<boolean>;
  abstract markCompleted(input: IMarkTerminalJobInput): Promise<boolean>;
  abstract markFailed(input: IMarkTerminalJobInput): Promise<boolean>;
  abstract findStaleClaims(input: IFindStaleClaimsInput): Promise<ProcessingJob[]>;
  abstract releaseStaleClaim(input: IReleaseStaleClaimInput): Promise<boolean>;
  abstract countDueJobs(input: ICountDueJobsInput): Promise<number>;
}
