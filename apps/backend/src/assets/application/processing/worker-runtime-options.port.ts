export interface IWorkerRuntimeOptions {
  pollIntervalMs: number;
  concurrency: number;
  heartbeatIntervalMs: number;
  staleClaimMs: number;
  maxAttempts: number;
  initialBackoffMs: number;
  backoffMultiplier: number;
  maxBackoffMs: number;
  workflowTimeoutMs: number;
  shutdownGraceMs: number;
  orphanIntentSweepIntervalMs: number;
  orphanIntentGraceMs: number;
}

export abstract class WorkerRuntimeOptionsPort {
  abstract get(): IWorkerRuntimeOptions;
}
