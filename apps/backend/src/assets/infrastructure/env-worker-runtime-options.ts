import { environmentConfiguration } from "@/shared/infrastructure/environment.configuration";

import {
  type IWorkerRuntimeOptions,
  WorkerRuntimeOptionsPort,
} from "../application/processing/worker-runtime-options.port";

export class EnvWorkerRuntimeOptions extends WorkerRuntimeOptionsPort {
  get(): IWorkerRuntimeOptions {
    return {
      pollIntervalMs: environmentConfiguration.PROCESSING_WORKER_POLL_INTERVAL_MS,
      concurrency: environmentConfiguration.PROCESSING_WORKER_CONCURRENCY,
      heartbeatIntervalMs: environmentConfiguration.PROCESSING_WORKER_HEARTBEAT_INTERVAL_MS,
      staleClaimMs: environmentConfiguration.PROCESSING_WORKER_STALE_CLAIM_MS,
      maxAttempts: environmentConfiguration.PROCESSING_WORKER_MAX_ATTEMPTS,
      initialBackoffMs: environmentConfiguration.PROCESSING_WORKER_INITIAL_BACKOFF_MS,
      backoffMultiplier: environmentConfiguration.PROCESSING_WORKER_BACKOFF_MULTIPLIER,
      maxBackoffMs: environmentConfiguration.PROCESSING_WORKER_MAX_BACKOFF_MS,
      workflowTimeoutMs: environmentConfiguration.PROCESSING_WORKER_WORKFLOW_TIMEOUT_MS,
      shutdownGraceMs: environmentConfiguration.PROCESSING_WORKER_SHUTDOWN_GRACE_MS,
      orphanIntentSweepIntervalMs: environmentConfiguration.ORPHAN_INTENT_SWEEP_INTERVAL_MS,
      orphanIntentGraceMs: environmentConfiguration.ORPHAN_INTENT_GRACE_MS,
    };
  }
}
