import type { ProcessingJobState } from "../value-objects/processing-job-state.value-object";

export interface IProcessingJobProps {
  assetId: string;
  state: ProcessingJobState;
  workerId: string | null;
  currentStep: string | null;
  attemptNumber: number;
  notBefore: Date | null;
  claimedAt: Date | null;
  heartbeatAt: Date | null;
  lastError: string | null;
  lastErrorAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class ProcessingJob {
  constructor(public readonly props: IProcessingJobProps) {}

  static fromProps(props: IProcessingJobProps): ProcessingJob {
    return new ProcessingJob(props);
  }
}
