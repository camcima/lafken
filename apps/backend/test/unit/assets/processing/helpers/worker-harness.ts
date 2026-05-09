import { ProcessingRetryPolicy } from "@/assets/application/processing/processing-retry-policy";
import { ProcessingWorkerService } from "@/assets/application/processing/processing-worker.service";
import { OrphanUploadIntentSweeperUseCase } from "@/assets/application/processing/orphan-upload-intent-sweeper.use-case";
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
import { IOrphanSweepInput } from "@/assets/application/processing/orphan-upload-intent-sweeper.use-case";

import { FakeAppLogger } from "../../../../__fakes__/fake-app-logger";
import { makeAsset, makePolicy } from "../processing-test-fixtures";

// ─────────────────────────────────────────────
// Minimal no-op job/asset repositories for the harness
// ─────────────────────────────────────────────

class NoopProcessingJobRepository extends ProcessingJobRepositoryPort {
  claimAvailable(_input: IClaimJobsInput) {
    return Promise.resolve([]);
  }
  heartbeat(_input: IHeartbeatInput) {
    return Promise.resolve(true);
  }
  updateCurrentStep(_input: IHeartbeatInput & { currentStep: string }) {
    return Promise.resolve(true);
  }
  releaseForRetry(_input: IReleaseForRetryInput) {
    return Promise.resolve(true);
  }
  markCompleted(_input: IMarkTerminalJobInput) {
    return Promise.resolve(true);
  }
  markFailed(_input: IMarkTerminalJobInput) {
    return Promise.resolve(true);
  }
  findStaleClaims() {
    return Promise.resolve([]);
  }
  releaseStaleClaim() {
    return Promise.resolve(true);
  }
}

class NoopAssetProcessingRepository extends AssetProcessingRepositoryPort {
  findAssetWithPolicy(assetId: string): Promise<IAssetWithPolicy | null> {
    return Promise.resolve({ asset: makeAsset({ id: assetId }), policy: makePolicy() });
  }
  transitionAsset(_input: ITransitionAssetInput) {
    return Promise.resolve(true);
  }
  recordAnalysis(_input: IRecordAnalysisInput) {
    return Promise.resolve();
  }
  updateDerivedMetadata(_input: IUpdateDerivedMetadataInput) {
    return Promise.resolve();
  }
  restartProcessing(): never {
    throw new Error("not used in harness");
  }
}

class NoopProcessor {
  execute(_input: { assetId: string; workerId: string; attemptNumber: number }) {
    return Promise.resolve();
  }
}

// ─────────────────────────────────────────────
// Orphan sweeper spy
// ─────────────────────────────────────────────

interface IOrphanSweeperSpy extends OrphanUploadIntentSweeperUseCase {
  executeCalls: IOrphanSweepInput[];
}

export function buildOrphanSweeperSpy(): IOrphanSweeperSpy {
  const executeCalls: IOrphanSweepInput[] = [];

  const spy: IOrphanSweeperSpy = Object.assign(
    Object.create(OrphanUploadIntentSweeperUseCase.prototype) as OrphanUploadIntentSweeperUseCase,
    {
      executeCalls,
      execute(input: IOrphanSweepInput): Promise<void> {
        executeCalls.push(input);
        return Promise.resolve();
      },
    },
  );

  return spy;
}

// ─────────────────────────────────────────────
// Worker harness
// ─────────────────────────────────────────────

interface IWorkerHarnessOptions {
  orphanSweeper?: OrphanUploadIntentSweeperUseCase;
}

interface IWorkerHarnessResult {
  worker: ProcessingWorkerService;
}

export function buildWorkerHarness(opts: IWorkerHarnessOptions = {}): IWorkerHarnessResult {
  const retryPolicy = new ProcessingRetryPolicy({
    maxAttempts: 5,
    initialBackoffMs: 1000,
    backoffMultiplier: 3,
    maxBackoffMs: 600_000,
    jitter: () => 0,
  });

  const worker = new ProcessingWorkerService(
    new NoopProcessingJobRepository(),
    new NoopProcessor(),
    retryPolicy,
    new NoopAssetProcessingRepository(),
    new FakeAppLogger(),
    undefined,
    { workflowTimeoutMs: 100 },
    opts.orphanSweeper,
  );

  return { worker };
}
