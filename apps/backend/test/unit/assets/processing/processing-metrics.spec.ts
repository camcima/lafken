import { beforeEach, describe, expect, it } from "vitest";

import { ProcessClaimedAssetUseCase } from "@/assets/application/processing/process-claimed-asset.use-case";
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
import type {
  IContentModerationInput,
  IContentModerationResult,
} from "@/assets/domain/services/content-moderation.service.port";
import { ContentModerationPort } from "@/assets/domain/services/content-moderation.service.port";
import type {
  IImageInspectionInput,
  IImageInspectionResult,
} from "@/assets/domain/services/image-inspection.service.port";
import { ImageInspectionPort } from "@/assets/domain/services/image-inspection.service.port";
import type {
  IVirusScanInput,
  IVirusScanResult,
} from "@/assets/domain/services/virus-scan.service.port";
import { VirusScanPort } from "@/assets/domain/services/virus-scan.service.port";
import type { NamespacePolicy } from "@/namespaces/domain/entities/namespace-policy.entity";
import { OpenTelemetryMetricsAdapter } from "@/shared/infrastructure/metrics/metrics.adapter";
import { LAFKEN_METRIC_NAMES } from "@/shared/infrastructure/telemetry/metrics";
import type { StorageBinding } from "@/system/domain/entities/storage-binding.entity";
import { StorageBindingQueryRepositoryPort } from "@/system/domain/repositories/storage-binding-query.repository.port";

import { FakeAppLogger } from "../../../__fakes__/fake-app-logger";
import { FakeAssetStorage } from "../../../__fakes__/fake-asset-storage";
import { FakeWorkerRuntimeOptionsPort } from "../../../__fakes__/fake-worker-runtime-options.port";
import {
  findCounterPoint,
  type IMetricReaderHandle,
  installInMemoryMetricReader,
} from "../../../__mocks__/in-memory-metric-reader";
import {
  FakeMimeSniff,
  makeAsset,
  makeJob,
  makePolicy,
  makeStorageBinding,
  TEST_UUIDS,
} from "./processing-test-fixtures";

class InMemoryAssetProcessingRepository extends AssetProcessingRepositoryPort {
  asset: Asset = makeAsset();
  policy: NamespacePolicy = makePolicy();
  readonly transitions: ITransitionAssetInput[] = [];

  findAssetWithPolicy(assetId: string): Promise<IAssetWithPolicy | null> {
    if (assetId !== this.asset.props.id) return Promise.resolve(null);
    return Promise.resolve({ asset: this.asset, policy: this.policy });
  }

  transitionAsset(input: ITransitionAssetInput): Promise<boolean> {
    this.transitions.push(input);
    this.asset = makeAsset({ state: input.toState });
    return Promise.resolve(true);
  }

  recordAnalysis(_input: IRecordAnalysisInput): Promise<void> {
    return Promise.resolve();
  }

  updateDerivedMetadata(_input: IUpdateDerivedMetadataInput): Promise<void> {
    return Promise.resolve();
  }

  restartProcessing(): never {
    throw new Error("not implemented");
  }
}

class InMemoryProcessingJobRepository extends ProcessingJobRepositoryPort {
  claimAvailable(_input: IClaimJobsInput): Promise<ProcessingJob[]> {
    return Promise.resolve([]);
  }
  heartbeat(_input: IHeartbeatInput): Promise<boolean> {
    return Promise.resolve(true);
  }
  updateCurrentStep(_input: IHeartbeatInput & { currentStep: string }): Promise<boolean> {
    return Promise.resolve(true);
  }
  releaseForRetry(_input: IReleaseForRetryInput): Promise<boolean> {
    return Promise.resolve(true);
  }
  markCompleted(_input: IMarkTerminalJobInput): Promise<boolean> {
    return Promise.resolve(true);
  }
  markFailed(_input: IMarkTerminalJobInput): Promise<boolean> {
    return Promise.resolve(true);
  }
  findStaleClaims(): never {
    throw new Error("not used");
  }
  releaseStaleClaim(): never {
    throw new Error("not used");
  }
  countDueJobs(): never {
    throw new Error("not used");
  }
  cancelForAsset(): never {
    throw new Error("not used");
  }
}

class FakeImageInspection extends ImageInspectionPort {
  result: IImageInspectionResult = {
    decision: "pass",
    reason: null,
    actualMimeType: "image/png",
    format: "png",
    sizeBytes: 12n,
    width: 2,
    height: 3,
    contentHash: Buffer.alloc(32, 1),
    captureContext: null,
    analyzer: "image_inspection",
    analyzerVersion: "test",
    findings: { duration_ms: 3 },
  };

  inspect(_input: IImageInspectionInput): Promise<IImageInspectionResult> {
    return Promise.resolve(this.result);
  }
}

class FakeVirusScan extends VirusScanPort {
  result: IVirusScanResult = {
    decision: "pass",
    reason: null,
    analyzer: "virus_scan",
    analyzerVersion: "test",
    findings: { duration_ms: 4 },
  };

  scan(_input: IVirusScanInput): Promise<IVirusScanResult> {
    return Promise.resolve(this.result);
  }
}

class FakeContentModeration extends ContentModerationPort {
  result: IContentModerationResult = {
    decision: "pass",
    reason: null,
    analyzer: "content_moderation",
    analyzerVersion: "test",
    findings: { duration_ms: 5 },
  };

  analyze(_input: IContentModerationInput): Promise<IContentModerationResult> {
    return Promise.resolve(this.result);
  }
}

class FakeStorageBindingRepository extends StorageBindingQueryRepositoryPort {
  binding: StorageBinding = makeStorageBinding();

  list(): Promise<StorageBinding[]> {
    return Promise.resolve([this.binding]);
  }
  findByName(_name: string): Promise<StorageBinding | null> {
    return Promise.resolve(this.binding);
  }
  findById(id: string): Promise<StorageBinding | null> {
    return Promise.resolve(id === this.binding.props.id ? this.binding : null);
  }
}

describe("processing pipeline metrics", () => {
  let handle: IMetricReaderHandle;

  beforeEach(() => {
    handle = installInMemoryMetricReader();
    handle.reset();
  });

  it("emits step.outcome and terminal_state=ready for a successful pipeline run", async () => {
    const assetRepo = new InMemoryAssetProcessingRepository();
    const jobRepo = new InMemoryProcessingJobRepository();
    const storage = new FakeAssetStorage();
    storage.objects.set("uploads/test.png", Buffer.from("image-bytes"));
    const useCase = new ProcessClaimedAssetUseCase(
      assetRepo,
      jobRepo,
      storage,
      new FakeImageInspection(),
      new FakeVirusScan(),
      new FakeContentModeration(),
      new FakeMimeSniff(),
      new FakeStorageBindingRepository(),
      new FakeAppLogger(),
      new OpenTelemetryMetricsAdapter(),
    );

    await useCase.execute({
      assetId: TEST_UUIDS.asset1,
      workerId: "worker-a",
      attemptNumber: 1,
    });

    await handle.forceFlush();

    expect(
      findCounterPoint(handle.exporter, LAFKEN_METRIC_NAMES.PROCESSING_STEP_OUTCOME, {
        step: "virus_scan",
        decision: "pass",
      })?.value,
    ).toBe(1);

    expect(
      findCounterPoint(handle.exporter, LAFKEN_METRIC_NAMES.PROCESSING_TERMINAL_STATE, {
        state: "ready",
      })?.value,
    ).toBe(1);
  });
});

describe("processing worker metrics", () => {
  let handle: IMetricReaderHandle;

  beforeEach(() => {
    handle = installInMemoryMetricReader();
    handle.reset();
  });

  it("emits processing.job.claimed once per claimed job", async () => {
    const jobRepo = new SpyJobRepository();
    jobRepo.claimedJobs = [makeJob(TEST_UUIDS.asset1)];
    const assetRepo = new InMemoryAssetProcessingRepository();
    const processor = new FakeProcessor();
    const retryPolicy = new ProcessingRetryPolicy({
      maxAttempts: 5,
      initialBackoffMs: 1000,
      backoffMultiplier: 3,
      maxBackoffMs: 600_000,
      jitter: () => 0,
    });
    const service = new ProcessingWorkerService(
      jobRepo,
      processor,
      retryPolicy,
      assetRepo,
      new FakeAppLogger(),
      new OpenTelemetryMetricsAdapter(),
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

    await service.tick();
    await service.drainInFlight();

    await handle.forceFlush();

    expect(
      findCounterPoint(handle.exporter, LAFKEN_METRIC_NAMES.PROCESSING_JOB_CLAIMED)?.value,
    ).toBe(1);
  });

  it("registers a queue_depth observable callback that observes countDueJobs", async () => {
    const jobRepo = new SpyJobRepository();
    jobRepo.dueJobsCount = 7;
    const assetRepo = new InMemoryAssetProcessingRepository();
    const processor = new FakeProcessor();
    const retryPolicy = new ProcessingRetryPolicy({
      maxAttempts: 5,
      initialBackoffMs: 1000,
      backoffMultiplier: 3,
      maxBackoffMs: 600_000,
      jitter: () => 0,
    });
    const service = new ProcessingWorkerService(
      jobRepo,
      processor,
      retryPolicy,
      assetRepo,
      new FakeAppLogger(),
      new OpenTelemetryMetricsAdapter(),
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

    service.registerQueueDepthCallback();

    // Force the periodic reader to collect; this triggers all registered
    // observable callbacks, including the one we just registered.
    await handle.forceFlush();

    const metrics = handle.exporter.getMetrics();
    const queueDepthMetric = metrics
      .flatMap((batch) => batch.scopeMetrics.flatMap((scope) => scope.metrics))
      .find((m) => m.descriptor.name === LAFKEN_METRIC_NAMES.PROCESSING_QUEUE_DEPTH);

    expect(queueDepthMetric).toBeDefined();
    expect(queueDepthMetric?.dataPoints[0]?.value).toBe(7);

    service.beginShutdown();
  });

  it("emits processing.retry { error_class: 'transient' } and processing.job.released { reason: 'transient_error' } on transient failure", async () => {
    const jobRepo = new SpyJobRepository();
    jobRepo.claimedJobs = [makeJob(TEST_UUIDS.asset1)];
    const assetRepo = new InMemoryAssetProcessingRepository();
    const processor = new FakeProcessor();
    processor.failures = 1;
    processor.errorFactory = (): Error =>
      new TransientProcessingError("virus_scan", new Error("boom"));
    const retryPolicy = new ProcessingRetryPolicy({
      maxAttempts: 5,
      initialBackoffMs: 1000,
      backoffMultiplier: 3,
      maxBackoffMs: 600_000,
      jitter: () => 0,
    });
    const service = new ProcessingWorkerService(
      jobRepo,
      processor,
      retryPolicy,
      assetRepo,
      new FakeAppLogger(),
      new OpenTelemetryMetricsAdapter(),
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

    await service.tick();
    await service.drainInFlight();

    await handle.forceFlush();

    expect(
      findCounterPoint(handle.exporter, LAFKEN_METRIC_NAMES.PROCESSING_RETRY, {
        error_class: "transient",
      })?.value,
    ).toBe(1);
    expect(
      findCounterPoint(handle.exporter, LAFKEN_METRIC_NAMES.PROCESSING_JOB_RELEASED, {
        reason: "transient_error",
      })?.value,
    ).toBe(1);
  });
});

class SpyJobRepository extends ProcessingJobRepositoryPort {
  claimedJobs: ProcessingJob[] = [];
  dueJobsCount = 0;
  readonly claimCalls: IClaimJobsInput[] = [];

  claimAvailable(input: IClaimJobsInput): Promise<ProcessingJob[]> {
    this.claimCalls.push(input);
    return Promise.resolve(this.claimedJobs);
  }
  heartbeat(_input: IHeartbeatInput): Promise<boolean> {
    return Promise.resolve(true);
  }
  updateCurrentStep(_input: IHeartbeatInput & { currentStep: string }): Promise<boolean> {
    return Promise.resolve(true);
  }
  releaseForRetry(_input: IReleaseForRetryInput): Promise<boolean> {
    return Promise.resolve(true);
  }
  markCompleted(_input: IMarkTerminalJobInput): Promise<boolean> {
    return Promise.resolve(true);
  }
  markFailed(_input: IMarkTerminalJobInput): Promise<boolean> {
    return Promise.resolve(true);
  }
  findStaleClaims(): never {
    throw new Error("not used");
  }
  releaseStaleClaim(): never {
    throw new Error("not used");
  }
  countDueJobs(): Promise<number> {
    return Promise.resolve(this.dueJobsCount);
  }
  cancelForAsset(): never {
    throw new Error("not used");
  }
}

class FakeProcessor {
  failures = 0;
  errorFactory: () => Error = () => new Error("processor failure");

  execute(_input: { assetId: string; workerId: string; attemptNumber: number }): Promise<unknown> {
    if (this.failures > 0) {
      this.failures -= 1;
      return Promise.reject(this.errorFactory());
    }
    return Promise.resolve();
  }
}
