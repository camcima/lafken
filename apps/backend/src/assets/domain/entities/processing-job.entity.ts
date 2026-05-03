export interface IProcessingJobProps {
  assetId: bigint;
  state: string;
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
