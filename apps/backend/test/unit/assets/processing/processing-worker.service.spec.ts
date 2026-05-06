import { beforeEach, describe, expect, it } from "vitest";

import { ProcessingWorkerService } from "@/assets/application/processing/processing-worker.service";
import type { ProcessingJob } from "@/assets/domain/entities/processing-job.entity";
import {
  type IClaimJobsInput,
  type IHeartbeatInput,
  type IMarkTerminalJobInput,
  ProcessingJobRepositoryPort,
} from "@/assets/domain/repositories/processing-job.repository.port";

import { FakeAppLogger } from "../../../__fakes__/fake-app-logger";
import { makeJob, TEST_UUIDS } from "./processing-test-fixtures";

describe("ProcessingWorkerService", () => {
  let jobRepo: FakeProcessingJobRepository;
  let processor: FakeProcessClaimedAssetUseCase;
  let service: ProcessingWorkerService;

  beforeEach(() => {
    jobRepo = new FakeProcessingJobRepository();
    processor = new FakeProcessClaimedAssetUseCase();
    service = new ProcessingWorkerService(jobRepo, processor, new FakeAppLogger());
  });

  it("claims available jobs up to remaining concurrency and processes each job", async () => {
    jobRepo.claimedJobs = [makeJob(TEST_UUIDS.asset1)];

    await service.tick();

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
});

class FakeProcessingJobRepository extends ProcessingJobRepositoryPort {
  claimedJobs: ProcessingJob[] = [];
  readonly claimCalls: IClaimJobsInput[] = [];
  readonly heartbeatCalls: Array<{ assetId: string; workerId: string }> = [];

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

  releaseForRetry(): never {
    throw new Error("releaseForRetry is not used by ProcessingWorkerService tests");
  }

  markCompleted(input: IMarkTerminalJobInput): Promise<boolean> {
    void input;
    return Promise.resolve(true);
  }

  markFailed(input: IMarkTerminalJobInput): Promise<boolean> {
    void input;
    return Promise.resolve(true);
  }

  findStaleClaims(): never {
    throw new Error("findStaleClaims is not used by ProcessingWorkerService tests");
  }

  releaseStaleClaim(): never {
    throw new Error("releaseStaleClaim is not used by ProcessingWorkerService tests");
  }
}

class FakeProcessClaimedAssetUseCase {
  readonly calls: Array<{ assetId: string; workerId: string; attemptNumber: number }> = [];

  execute(input: { assetId: string; workerId: string; attemptNumber: number }): Promise<void> {
    this.calls.push(input);
    return Promise.resolve();
  }
}
