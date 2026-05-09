import { beforeEach, describe, expect, it } from "vitest";

import { ReclaimStaleProcessingJobsUseCase } from "@/assets/application/processing/reclaim-stale-processing-jobs.use-case";
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
  type IFindStaleClaimsInput,
  type IMarkTerminalJobInput,
  type IReleaseStaleClaimInput,
  ProcessingJobRepositoryPort,
} from "@/assets/domain/repositories/processing-job.repository.port";
import type { AssetState } from "@/assets/domain/value-objects/asset-state.value-object";
import type { NamespacePolicy } from "@/namespaces/domain/entities/namespace-policy.entity";

import { FakeAppLogger } from "../../../__fakes__/fake-app-logger";
import { makeAsset, makeJob, makePolicy, TEST_UUIDS } from "./processing-test-fixtures";

describe("ReclaimStaleProcessingJobsUseCase", () => {
  let assetRepo: StaleAssetRepository;
  let jobRepo: StaleJobRepository;
  let useCase: ReclaimStaleProcessingJobsUseCase;

  beforeEach(() => {
    assetRepo = new StaleAssetRepository();
    jobRepo = new StaleJobRepository();
    useCase = new ReclaimStaleProcessingJobsUseCase(jobRepo, assetRepo, new FakeAppLogger());
  });

  it("marks stale terminal assets completed", async () => {
    assetRepo.assetState = "ready";
    jobRepo.staleJobs = [makeJob(TEST_UUIDS.asset1, 2)];

    await useCase.execute({ now: new Date("2026-05-06T12:00:00.000Z") });

    expect(jobRepo.completed).toBe(true);
  });

  it("releases stale jobs when attempts remain", async () => {
    assetRepo.assetState = "processing";
    jobRepo.staleJobs = [makeJob(TEST_UUIDS.asset1, 2)];

    await useCase.execute({ now: new Date("2026-05-06T12:00:00.000Z") });

    expect(jobRepo.releasedStale).toEqual({ assetId: TEST_UUIDS.asset1, nextAttemptNumber: 3 });
  });

  it("transitions to processing_failed when stale attempts are exhausted", async () => {
    assetRepo.assetState = "processing";
    jobRepo.staleJobs = [makeJob(TEST_UUIDS.asset1, 5)];

    await useCase.execute({ now: new Date("2026-05-06T12:00:00.000Z") });

    expect(assetRepo.transitions.at(-1)?.toState).toBe("processing_failed");
    expect(jobRepo.failed).toBe(true);
  });

  it("skips markFailed when transitionAsset loses race during exhaustion", async () => {
    assetRepo.assetState = "processing";
    assetRepo.transitionResult = false;
    jobRepo.staleJobs = [makeJob(TEST_UUIDS.asset1, 5)];

    await useCase.execute({ now: new Date("2026-05-06T12:00:00.000Z") });

    expect(assetRepo.transitions).toHaveLength(1);
    expect(jobRepo.failed).toBe(false);
  });

  it("marks job failed without transitioning asset when asset is still uploaded at exhaustion", async () => {
    // Worker died before the 'uploaded -> processing' transition ran. The
    // reclaimer must not try 'uploaded -> processing_failed' (illegal); just
    // mark the job failed so it stops being retried.
    assetRepo.assetState = "uploaded";
    jobRepo.staleJobs = [makeJob(TEST_UUIDS.asset1, 5)];

    await useCase.execute({ now: new Date("2026-05-06T12:00:00.000Z") });

    expect(assetRepo.transitions).toHaveLength(0);
    expect(jobRepo.failed).toBe(true);
  });
});

class StaleAssetRepository extends AssetProcessingRepositoryPort {
  assetState: AssetState = "processing";
  transitionResult = true;
  readonly policy: NamespacePolicy = makePolicy();
  readonly transitions: ITransitionAssetInput[] = [];

  findAssetWithPolicy(assetId: string): Promise<IAssetWithPolicy | null> {
    const asset: Asset = makeAsset({ id: assetId, state: this.assetState });
    return Promise.resolve({ asset, policy: this.policy });
  }

  transitionAsset(input: ITransitionAssetInput): Promise<boolean> {
    this.transitions.push(input);
    return Promise.resolve(this.transitionResult);
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
    throw new Error("restartProcessing is not used by stale reclaim tests");
  }
}

class StaleJobRepository extends ProcessingJobRepositoryPort {
  staleJobs: ProcessingJob[] = [];
  completed = false;
  failed = false;
  releasedStale: { assetId: string; nextAttemptNumber: number } | null = null;

  claimAvailable(): never {
    throw new Error("claimAvailable is not used by stale reclaim tests");
  }

  heartbeat(): never {
    throw new Error("heartbeat is not used by stale reclaim tests");
  }

  updateCurrentStep(): never {
    throw new Error("updateCurrentStep is not used by stale reclaim tests");
  }

  releaseForRetry(): never {
    throw new Error("releaseForRetry is not used by stale reclaim tests");
  }

  markCompleted(input: IMarkTerminalJobInput): Promise<boolean> {
    void input;
    this.completed = true;
    return Promise.resolve(true);
  }

  markFailed(input: IMarkTerminalJobInput): Promise<boolean> {
    void input;
    this.failed = true;
    return Promise.resolve(true);
  }

  findStaleClaims(input: IFindStaleClaimsInput): Promise<ProcessingJob[]> {
    void input;
    return Promise.resolve(this.staleJobs);
  }

  releaseStaleClaim(input: IReleaseStaleClaimInput): Promise<boolean> {
    this.releasedStale = {
      assetId: input.assetId,
      nextAttemptNumber: input.nextAttemptNumber,
    };
    return Promise.resolve(true);
  }

  countDueJobs(): never {
    throw new Error("countDueJobs is not used by stale reclaim tests");
  }
}
