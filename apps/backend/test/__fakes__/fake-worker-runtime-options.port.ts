import type { IWorkerRuntimeOptions } from "@/assets/application/processing/worker-runtime-options.port";
import { WorkerRuntimeOptionsPort } from "@/assets/application/processing/worker-runtime-options.port";

export const DEFAULT_FAKE_WORKER_RUNTIME_OPTIONS: IWorkerRuntimeOptions = {
  pollIntervalMs: 1000,
  concurrency: 5,
  heartbeatIntervalMs: 5000,
  staleClaimMs: 60_000,
  maxAttempts: 5,
  initialBackoffMs: 1000,
  backoffMultiplier: 3,
  maxBackoffMs: 600_000,
  workflowTimeoutMs: 300_000,
  shutdownGraceMs: 30_000,
  orphanIntentSweepIntervalMs: 60_000,
  orphanIntentGraceMs: 300_000,
};

export class FakeWorkerRuntimeOptionsPort extends WorkerRuntimeOptionsPort {
  constructor(private readonly opts: IWorkerRuntimeOptions = DEFAULT_FAKE_WORKER_RUNTIME_OPTIONS) {
    super();
  }

  get(): IWorkerRuntimeOptions {
    return this.opts;
  }
}
