import type { ProcessingJob } from "@/assets/domain/entities/processing-job.entity";

export interface IClaimAvailableInput {
  workerId: string;
  limit: number;
  now: Date;
}

export interface IHeartbeatInput {
  assetId: string;
  workerId: string;
  now: Date;
}

export interface IUpdateCurrentStepInput {
  assetId: string;
  workerId: string;
  step: string;
}

export interface IReleaseForRetryInput {
  assetId: string;
  workerId: string;
  notBefore: Date;
  attemptNumber: number;
  lastError: string;
  now: Date;
}

export interface IMarkCompletedInput {
  assetId: string;
  workerId: string;
  now: Date;
}

export interface IMarkFailedInput {
  assetId: string;
  workerId: string;
  lastError: string;
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

export abstract class ProcessingJobRepositoryPort {
  abstract claimAvailable(input: IClaimAvailableInput): Promise<ProcessingJob[]>;
  abstract heartbeat(input: IHeartbeatInput): Promise<void>;
  abstract updateCurrentStep(input: IUpdateCurrentStepInput): Promise<void>;
  abstract releaseForRetry(input: IReleaseForRetryInput): Promise<void>;
  abstract markCompleted(input: IMarkCompletedInput): Promise<void>;
  abstract markFailed(input: IMarkFailedInput): Promise<void>;
  abstract findStaleClaims(input: IFindStaleClaimsInput): Promise<ProcessingJob[]>;
  abstract releaseStaleClaim(input: IReleaseStaleClaimInput): Promise<void>;
}
