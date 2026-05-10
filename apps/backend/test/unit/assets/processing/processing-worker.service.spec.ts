import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProcessingRetryPolicy } from "@/assets/application/processing/processing-retry-policy";
import { ProcessingWorkerService } from "@/assets/application/processing/processing-worker.service";
import { TransientProcessingError } from "@/assets/application/processing/transient-processing.error";
import type { Asset } from "@/assets/domain/entities/asset.entity";
import type { ProcessingJob } from "@/assets/domain/entities/processing-job.entity";
import {
  AssetProcessingRepositoryPort,
  type IAssetWithPolicy,
  type IRecordAnalysisInput,
  type ITransitionAssetInput,
  type IUpdateDerivedMetadataInput,
} from "@/assets/domain/repositories/asset-processing.repository.port";
import {
  type IClaimJobsInput,
  type IHeartbeatInput,
  type IMarkTerminalJobInput,
  type IReleaseForRetryInput,
  ProcessingJobRepositoryPort,
} from "@/assets/domain/repositories/processing-job.repository.port";
import type { NamespacePolicy } from "@/namespaces/domain/entities/namespace-policy.entity";

import { FakeAppLogger } from "../../../__fakes__/fake-app-logger";
import { FakeMetricsPort } from "../../../__fakes__/fake-metrics.port";
import { FakeWorkerRuntimeOptionsPort } from "../../../__fakes__/fake-worker-runtime-options.port";
import { makeAsset, makeJob, makePolicy, TEST_UUIDS } from "./processing-test-fixtures";

describe("ProcessingWorkerService", () => {
  let jobRepo: FakeProcessingJobRepository;
  let assetRepo: FakeAssetProcessingRepository;
  let processor: FakeProcessClaimedAssetUseCase;
  let retryPolicy: ProcessingRetryPolicy;
  let service: ProcessingWorkerService;

  beforeEach(() => {
    jobRepo = new FakeProcessingJobRepository();
    assetRepo = new FakeAssetProcessingRepository();
    processor = new FakeProcessClaimedAssetUseCase();
    retryPolicy = new ProcessingRetryPolicy({
      maxAttempts: 5,
      initialBackoffMs: 1000,
      backoffMultiplier: 3,
      maxBackoffMs: 600_000,
      jitter: () => 0,
    });
    service = new ProcessingWorkerService(
      jobRepo,
      processor,
      retryPolicy,
      assetRepo,
      new FakeAppLogger(),
      new FakeMetricsPort(),
      new FakeWorkerRuntimeOptionsPort({
        workflowTimeoutMs: 100,
        pollIntervalMs: 1000,
        concurrency: 5,
        heartbeatIntervalMs: 5000,
        staleClaimMs: 60_000,
        maxAttempts: 5,
        initialBackoffMs: 1000,
        backoffMultiplier: 3,
        maxBackoffMs: 600_000,
        shutdownGraceMs: 30_000,
        orphanIntentSweepIntervalMs: 60_000,
        orphanIntentGraceMs: 300_000,
      }),
    );
  });

  it("claims available jobs up to remaining concurrency and processes each job", async () => {
    jobRepo.claimedJobs = [makeJob(TEST_UUIDS.asset1)];

    await service.tick();
    await service.drainInFlight();

    expect(jobRepo.claimCalls).toHaveLength(1);
    expect(processor.calls).toEqual([
      { assetId: TEST_UUIDS.asset1, workerId: service.workerId, attemptNumber: 1 },
    ]);
  });

  it("heartbeats inflight jobs", async () => {
    service.trackInFlight(TEST_UUIDS.asset1);

    await service.heartbeat();

    expect(jobRepo.heartbeatCalls).toEqual([
      { assetId: TEST_UUIDS.asset1, workerId: service.workerId },
    ]);
  });

  it("does not claim new jobs after shutdown begins", async () => {
    service.beginShutdown();

    await service.tick();

    expect(jobRepo.claimCalls).toHaveLength(0);
  });

  it("releases the job for delayed retry after a single transient failure", async () => {
    jobRepo.claimedJobs = [makeJob(TEST_UUIDS.asset1)];
    processor.failures = 1;
    processor.errorFactory = () => new TransientProcessingError("virus_scan", new Error("boom"));

    await service.tick();
    await service.drainInFlight();

    expect(processor.calls).toHaveLength(1);
    expect(jobRepo.releaseCalls).toHaveLength(1);
    expect(jobRepo.releaseCalls[0]?.attemptNumber).toBe(2);
    expect(jobRepo.failedCalls).toEqual([]);
  });

  it("marks the job failed when the retry budget is exhausted", async () => {
    jobRepo.claimedJobs = [makeJob(TEST_UUIDS.asset1, 5)];
    processor.failures = 1;
    processor.errorFactory = () => new TransientProcessingError("virus_scan", new Error("boom"));

    await service.tick();
    await service.drainInFlight();

    expect(jobRepo.releaseCalls).toEqual([]);
    expect(jobRepo.failedCalls).toHaveLength(1);
    expect(assetRepo.transitions.at(-1)?.toState).toBe("processing_failed");
    expect(assetRepo.transitions.at(-1)?.reason).toBe("retry_budget_exhausted");
  });

  it("short-circuits to processing_failed for non-transient errors", async () => {
    jobRepo.claimedJobs = [makeJob(TEST_UUIDS.asset1)];
    processor.failures = 1;
    processor.errorFactory = () => new Error("permanent boom");

    await service.tick();
    await service.drainInFlight();

    expect(processor.calls).toHaveLength(1);
    expect(jobRepo.releaseCalls).toEqual([]);
    expect(jobRepo.failedCalls).toHaveLength(1);
    expect(assetRepo.transitions.at(-1)?.toState).toBe("processing_failed");
    expect(assetRepo.transitions.at(-1)?.reason).toBe("permanent_error");
  });

  it("transitions the asset to processing_failed with state_reason 'workflow_timeout' when the workflow exceeds the budget", async () => {
    vi.useFakeTimers();
    try {
      jobRepo.claimedJobs = [makeJob(TEST_UUIDS.asset1)];
      processor.neverResolve = true; // simulate a hung workflow

      const tickPromise: Promise<void> = service.tick();
      // Drive the timer past the configured 100 ms test timeout.
      await vi.advanceTimersByTimeAsync(150);
      await tickPromise;

      const lastTransition = assetRepo.transitions.at(-1);
      expect(lastTransition?.toState).toBe("processing_failed");
      expect(lastTransition?.reason).toBe("workflow_timeout");
      expect(jobRepo.failedCalls).toHaveLength(1);
      expect(jobRepo.failedCalls[0]?.lastError).toBe("workflow_timeout");
    } finally {
      vi.useRealTimers();
    }
  });

  describe("shutdown release", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("releases in-flight claims when the shutdown grace expires", async () => {
      vi.useFakeTimers();
      // Track an in-flight job whose underlying promise never settles, so the
      // grace race is forced to time out instead of completing cleanly.
      const neverSettling: Promise<void> = new Promise<void>((): void => {});
      service.trackInFlight(TEST_UUIDS.asset1, 2, neverSettling);

      const destroyPromise: Promise<void> = service.onModuleDestroy();
      // The worker uses setTimeout(grace) to bound the wait; fast-forward
      // past it so the post-race release branch runs.
      await vi.advanceTimersByTimeAsync(30_000);
      await destroyPromise;

      expect(jobRepo.releaseCalls).toHaveLength(1);
      expect(jobRepo.releaseCalls[0]?.assetId).toBe(TEST_UUIDS.asset1);
      expect(jobRepo.releaseCalls[0]?.attemptNumber).toBe(2);
      expect(jobRepo.releaseCalls[0]?.lastError).toBe("worker_shutdown");
    });
  });
});

class FakeProcessingJobRepository extends ProcessingJobRepositoryPort {
  claimedJobs: ProcessingJob[] = [];
  readonly claimCalls: IClaimJobsInput[] = [];
  readonly heartbeatCalls: Array<{ assetId: string; workerId: string }> = [];
  readonly releaseCalls: IReleaseForRetryInput[] = [];
  readonly failedCalls: IMarkTerminalJobInput[] = [];

  claimAvailable(input: IClaimJobsInput): Promise<ProcessingJob[]> {
    this.claimCalls.push(input);
    return Promise.resolve(this.claimedJobs);
  }

  heartbeat(input: IHeartbeatInput): Promise<boolean> {
    this.heartbeatCalls.push({ assetId: input.assetId, workerId: input.workerId });
    return Promise.resolve(true);
  }

  updateCurrentStep(input: IHeartbeatInput & { currentStep: string }): Promise<boolean> {
    void input;
    return Promise.resolve(true);
  }

  releaseForRetry(input: IReleaseForRetryInput): Promise<boolean> {
    this.releaseCalls.push(input);
    return Promise.resolve(true);
  }

  markCompleted(input: IMarkTerminalJobInput): Promise<boolean> {
    void input;
    return Promise.resolve(true);
  }

  markFailed(input: IMarkTerminalJobInput): Promise<boolean> {
    this.failedCalls.push(input);
    return Promise.resolve(true);
  }

  findStaleClaims(): never {
    throw new Error("findStaleClaims is not used by ProcessingWorkerService tests");
  }

  releaseStaleClaim(): never {
    throw new Error("releaseStaleClaim is not used by ProcessingWorkerService tests");
  }

  dueJobsCount = 0;
  countDueJobs(): Promise<number> {
    return Promise.resolve(this.dueJobsCount);
  }
}

class FakeAssetProcessingRepository extends AssetProcessingRepositoryPort {
  readonly transitions: ITransitionAssetInput[] = [];
  readonly policy: NamespacePolicy = makePolicy();

  findAssetWithPolicy(assetId: string): Promise<IAssetWithPolicy | null> {
    const asset: Asset = makeAsset({ id: assetId, state: "processing" });
    return Promise.resolve({ asset, policy: this.policy });
  }

  transitionAsset(input: ITransitionAssetInput): Promise<boolean> {
    this.transitions.push(input);
    return Promise.resolve(true);
  }

  recordAnalysis(input: IRecordAnalysisInput): Promise<void> {
    void input;
    return Promise.resolve();
  }

  updateDerivedMetadata(input: IUpdateDerivedMetadataInput): Promise<void> {
    void input;
    return Promise.resolve();
  }

  restartProcessing(): never {
    throw new Error("restartProcessing is not used by ProcessingWorkerService tests");
  }
}

class FakeProcessClaimedAssetUseCase {
  readonly calls: Array<{ assetId: string; workerId: string; attemptNumber: number }> = [];
  failures = 0;
  neverResolve = false;
  errorFactory: () => Error = () => new Error("processor failure");

  execute(input: { assetId: string; workerId: string; attemptNumber: number }): Promise<unknown> {
    this.calls.push(input);
    if (this.neverResolve) {
      return new Promise<unknown>((): void => {});
    }
    if (this.failures > 0) {
      this.failures -= 1;
      return Promise.reject(this.errorFactory());
    }
    return Promise.resolve();
  }
}
