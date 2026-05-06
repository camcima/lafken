import { beforeEach, describe, expect, it } from "vitest";

import { ProcessClaimedAssetUseCase } from "@/assets/application/processing/process-claimed-asset.use-case";
import type { Asset } from "@/assets/domain/entities/asset.entity";
import {
  AssetProcessingRepositoryPort,
  type IAssetWithPolicy,
  type IRecordAnalysisInput,
  type ITransitionAssetInput,
  type IUpdateDerivedMetadataInput,
} from "@/assets/domain/repositories/asset-processing.repository.port";
import {
  type IHeartbeatInput,
  type IMarkTerminalJobInput,
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
import type { StorageBinding } from "@/system/domain/entities/storage-binding.entity";
import { StorageBindingQueryRepositoryPort } from "@/system/domain/repositories/storage-binding-query.repository.port";

import { FakeAppLogger } from "../../../__fakes__/fake-app-logger";
import { FakeAssetStorage } from "../../../__fakes__/fake-asset-storage";
import { makeAsset, makePolicy, makeStorageBinding, TEST_UUIDS } from "./processing-test-fixtures";

describe("ProcessClaimedAssetUseCase", () => {
  let assetRepo: InMemoryAssetProcessingRepository;
  let jobRepo: InMemoryProcessingJobRepository;
  let storage: FakeAssetStorage;
  let imageInspection: FakeImageInspection;
  let virusScan: FakeVirusScan;
  let moderation: FakeContentModeration;
  let storageBindings: FakeStorageBindingRepository;
  let useCase: ProcessClaimedAssetUseCase;

  beforeEach(() => {
    assetRepo = new InMemoryAssetProcessingRepository();
    jobRepo = new InMemoryProcessingJobRepository();
    storage = new FakeAssetStorage();
    storage.objects.set("uploads/test.png", Buffer.from("image-bytes"));
    imageInspection = new FakeImageInspection();
    virusScan = new FakeVirusScan();
    moderation = new FakeContentModeration();
    storageBindings = new FakeStorageBindingRepository();
    useCase = new ProcessClaimedAssetUseCase(
      assetRepo,
      jobRepo,
      storage,
      imageInspection,
      virusScan,
      moderation,
      storageBindings,
      new FakeAppLogger(),
    );
  });

  it("processes a valid uploaded asset to ready and records evidence", async () => {
    const result = await useCase.execute({
      assetId: TEST_UUIDS.asset1,
      workerId: "worker-a",
      attemptNumber: 1,
    });

    expect(result.kind).toBe("completed");
    expect(assetRepo.transitions.map((item) => item.toState)).toEqual(["processing", "ready"]);
    expect(assetRepo.analyses.map((item) => item.analyzer)).toEqual([
      "image_inspection",
      "virus_scan",
    ]);
    expect(jobRepo.completed).toBe(true);
    expect(jobRepo.currentStepUpdates.map((item) => item.currentStep)).toEqual([
      "image_inspection",
      "virus_scan",
    ]);
  });

  it("records current_step transitions in order when moderation is enabled", async () => {
    assetRepo.policy = makePolicy({ contentModeration: { localDecision: "pass" } });

    const result = await useCase.execute({
      assetId: TEST_UUIDS.asset1,
      workerId: "worker-a",
      attemptNumber: 1,
    });

    expect(result.kind).toBe("completed");
    expect(jobRepo.currentStepUpdates.map((item) => item.currentStep)).toEqual([
      "image_inspection",
      "virus_scan",
      "content_moderation",
    ]);
  });

  it("rejects deterministic image inspection failures without retry", async () => {
    imageInspection.result = {
      decision: "error",
      reason: "invalid_image_format",
      actualMimeType: null,
      format: null,
      sizeBytes: 12n,
      width: null,
      height: null,
      contentHash: Buffer.alloc(32, 1),
      captureContext: null,
      analyzer: "image_inspection",
      analyzerVersion: "test",
      findings: { reason: "invalid_image_format", duration_ms: 3 },
    };

    const result = await useCase.execute({
      assetId: TEST_UUIDS.asset1,
      workerId: "worker-a",
      attemptNumber: 1,
    });

    expect(result.kind).toBe("completed");
    expect(assetRepo.transitions.at(-1)?.toState).toBe("rejected");
    expect(assetRepo.transitions.at(-1)?.reason).toBe("invalid_image_format");
  });

  it("quarantines infected virus scan results", async () => {
    virusScan.result = {
      decision: "quarantine",
      reason: "virus_detected",
      analyzer: "virus_scan",
      analyzerVersion: "test",
      findings: { duration_ms: 4 },
    };

    const result = await useCase.execute({
      assetId: TEST_UUIDS.asset1,
      workerId: "worker-a",
      attemptNumber: 1,
    });

    expect(result.kind).toBe("completed");
    expect(assetRepo.transitions.at(-1)?.toState).toBe("quarantined_virus");
  });

  it("quarantines moderation results when policy config is present", async () => {
    assetRepo.policy = makePolicy({ contentModeration: { localDecision: "quarantine" } });
    moderation.result = {
      decision: "quarantine",
      reason: "moderation_quarantined",
      analyzer: "content_moderation",
      analyzerVersion: "test",
      findings: { duration_ms: 5 },
    };

    const result = await useCase.execute({
      assetId: TEST_UUIDS.asset1,
      workerId: "worker-a",
      attemptNumber: 1,
    });

    expect(result.kind).toBe("completed");
    expect(assetRepo.transitions.at(-1)?.toState).toBe("quarantined_moderation");
  });
});

class InMemoryAssetProcessingRepository extends AssetProcessingRepositoryPort {
  asset: Asset = makeAsset();
  policy: NamespacePolicy = makePolicy();
  readonly transitions: ITransitionAssetInput[] = [];
  readonly analyses: IRecordAnalysisInput[] = [];
  readonly derivedMetadata: IUpdateDerivedMetadataInput[] = [];

  findAssetWithPolicy(assetId: string): Promise<IAssetWithPolicy | null> {
    if (assetId !== this.asset.props.id) {
      return Promise.resolve(null);
    }
    return Promise.resolve({ asset: this.asset, policy: this.policy });
  }

  transitionAsset(input: ITransitionAssetInput): Promise<boolean> {
    this.transitions.push(input);
    this.asset = makeAsset({
      state: input.toState,
      stateReason: input.reason,
      sizeBytes: this.asset.props.sizeBytes,
      mimeType: this.asset.props.mimeType,
      width: this.asset.props.width,
      height: this.asset.props.height,
      contentHash: this.asset.props.contentHash,
      captureContext: this.asset.props.captureContext,
    });
    return Promise.resolve(true);
  }

  recordAnalysis(input: IRecordAnalysisInput): Promise<void> {
    this.analyses.push(input);
    return Promise.resolve();
  }

  updateDerivedMetadata(input: IUpdateDerivedMetadataInput): Promise<void> {
    this.derivedMetadata.push(input);
    return Promise.resolve();
  }
}

class InMemoryProcessingJobRepository extends ProcessingJobRepositoryPort {
  completed = false;
  failed = false;
  readonly currentStepUpdates: Array<{ currentStep: string; assetId: string }> = [];

  claimAvailable(): never {
    throw new Error("claimAvailable is not used by ProcessClaimedAssetUseCase tests");
  }

  heartbeat(input: IHeartbeatInput): Promise<boolean> {
    void input;
    return Promise.resolve(true);
  }

  updateCurrentStep(input: IHeartbeatInput & { currentStep: string }): Promise<boolean> {
    this.currentStepUpdates.push({
      currentStep: input.currentStep,
      assetId: input.assetId,
    });
    return Promise.resolve(true);
  }

  releaseForRetry(): never {
    throw new Error("releaseForRetry is not used by ProcessClaimedAssetUseCase tests");
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

  findStaleClaims(): never {
    throw new Error("findStaleClaims is not used by ProcessClaimedAssetUseCase tests");
  }

  releaseStaleClaim(): never {
    throw new Error("releaseStaleClaim is not used by ProcessClaimedAssetUseCase tests");
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
    captureContext: { captured_at: "2026-05-06T12:00:00.000Z" },
    analyzer: "image_inspection",
    analyzerVersion: "test",
    findings: { duration_ms: 3 },
  };

  inspect(input: IImageInspectionInput): Promise<IImageInspectionResult> {
    void input;
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

  scan(input: IVirusScanInput): Promise<IVirusScanResult> {
    void input;
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

  analyze(input: IContentModerationInput): Promise<IContentModerationResult> {
    void input;
    return Promise.resolve(this.result);
  }
}

class FakeStorageBindingRepository extends StorageBindingQueryRepositoryPort {
  binding: StorageBinding = makeStorageBinding();

  list(): Promise<StorageBinding[]> {
    return Promise.resolve([this.binding]);
  }

  findByName(name: string): Promise<StorageBinding | null> {
    void name;
    return Promise.resolve(this.binding);
  }

  findById(id: string): Promise<StorageBinding | null> {
    return Promise.resolve(id === this.binding.props.id ? this.binding : null);
  }
}
