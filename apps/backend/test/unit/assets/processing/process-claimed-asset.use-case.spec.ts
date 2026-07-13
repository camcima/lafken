import { beforeEach, describe, expect, it } from "vitest";

import { ProcessClaimedAssetUseCase } from "@/assets/application/processing/process-claimed-asset.use-case";
import { ProcessingAbortedError } from "@/assets/application/processing/processing-aborted.error";
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
import { FakeMetricsPort } from "../../../__fakes__/fake-metrics.port";
import {
  FakeMimeSniff,
  makeAsset,
  makePolicy,
  makeStorageBinding,
  TEST_UUIDS,
} from "./processing-test-fixtures";

describe("ProcessClaimedAssetUseCase", () => {
  let assetRepo: InMemoryAssetProcessingRepository;
  let jobRepo: InMemoryProcessingJobRepository;
  let storage: FakeAssetStorage;
  let imageInspection: FakeImageInspection;
  let virusScan: FakeVirusScan;
  let moderation: FakeContentModeration;
  let mimeSniff: FakeMimeSniff;
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
    mimeSniff = new FakeMimeSniff();
    storageBindings = new FakeStorageBindingRepository();
    useCase = new ProcessClaimedAssetUseCase(
      assetRepo,
      jobRepo,
      storage,
      imageInspection,
      virusScan,
      moderation,
      mimeSniff,
      storageBindings,
      new FakeAppLogger(),
      new FakeMetricsPort(),
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
      "virus_scan",
      "image_inspection",
    ]);
    expect(jobRepo.completed).toBe(true);
    expect(jobRepo.currentStepUpdates.map((item) => item.currentStep)).toEqual([
      "virus_scan",
      "magic_byte_detection",
      "image_inspection",
    ]);

    const readyTransition = assetRepo.transitions.at(-1);
    expect(readyTransition?.toState).toBe("ready");
    const metadata = readyTransition?.metadata ?? {};
    expect(typeof metadata["total_duration_ms"]).toBe("number");
    expect(metadata["total_duration_ms"] as number).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(metadata["steps"])).toBe(true);
    const steps = metadata["steps"] as Array<{ step: string }>;
    expect(steps.map((entry) => entry.step)).toEqual([
      "virus_scan",
      "magic_byte_detection",
      "image_inspection",
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
      "virus_scan",
      "magic_byte_detection",
      "image_inspection",
      "content_moderation",
    ]);

    const readyTransition = assetRepo.transitions.at(-1);
    expect(readyTransition?.toState).toBe("ready");
    const metadata = readyTransition?.metadata ?? {};
    const steps = metadata["steps"] as Array<{ step: string }>;
    expect(steps.map((entry) => entry.step)).toEqual([
      "virus_scan",
      "magic_byte_detection",
      "image_inspection",
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

  it("quarantines infected virus scan results without running image inspection", async () => {
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
    const terminalTransition = assetRepo.transitions.at(-1);
    expect(terminalTransition?.toState).toBe("quarantined_virus");
    expect(terminalTransition?.newStorageKey).toBe("_quarantined/uploads/test.png");
    expect(storage.moveCalls).toEqual([
      expect.objectContaining({
        fromKey: "uploads/test.png",
        toKey: "_quarantined/uploads/test.png",
      }),
    ]);
    // Virus scan is the first check; image inspection must not run.
    expect(assetRepo.analyses.map((entry) => entry.analyzer)).toEqual(["virus_scan"]);
    expect(jobRepo.currentStepUpdates.map((entry) => entry.currentStep)).toEqual(["virus_scan"]);
  });

  it("rejects with unrecognized_format when the magic-byte sniff returns null", async () => {
    mimeSniff.result = null;

    await useCase.execute({ assetId: TEST_UUIDS.asset1, workerId: "worker-a", attemptNumber: 1 });

    const terminal = assetRepo.transitions.at(-1);
    expect(terminal?.toState).toBe("rejected");
    expect(terminal?.reason).toBe("unrecognized_format");
  });

  it("rejects with mime_type_not_allowed when sniffed MIME is outside policy allow-list", async () => {
    mimeSniff.result = "image/gif";

    await useCase.execute({ assetId: TEST_UUIDS.asset1, workerId: "worker-a", attemptNumber: 1 });

    const terminal = assetRepo.transitions.at(-1);
    expect(terminal?.toState).toBe("rejected");
    expect(terminal?.reason).toBe("mime_type_not_allowed");
  });

  it("rejects with format_inconsistency when sharp's detected format disagrees with the sniffed MIME", async () => {
    mimeSniff.result = "image/png";
    imageInspection.result = {
      decision: "error",
      reason: "format_inconsistency",
      actualMimeType: "image/jpeg",
      format: "jpeg",
      sizeBytes: 12n,
      width: null,
      height: null,
      contentHash: Buffer.alloc(32),
      captureContext: null,
      analyzer: "image_inspection",
      analyzerVersion: "sharp-v1",
      findings: { duration_ms: 0 },
    };

    await useCase.execute({ assetId: TEST_UUIDS.asset1, workerId: "worker-a", attemptNumber: 1 });

    const terminal = assetRepo.transitions.at(-1);
    expect(terminal?.toState).toBe("rejected");
    expect(terminal?.reason).toBe("format_inconsistency");
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
    const terminalTransition = assetRepo.transitions.at(-1);
    expect(terminalTransition?.toState).toBe("quarantined_moderation");
    expect(terminalTransition?.newStorageKey).toBe("_quarantined/uploads/test.png");
    expect(storage.moveCalls).toEqual([
      expect.objectContaining({
        fromKey: "uploads/test.png",
        toKey: "_quarantined/uploads/test.png",
      }),
    ]);
  });

  it("completes the job without processing when the asset is already deleted", async () => {
    assetRepo.asset = makeAsset({ state: "deleted" });

    const result = await useCase.execute({
      assetId: TEST_UUIDS.asset1,
      workerId: "worker-a",
      attemptNumber: 1,
    });

    expect(result.kind).toBe("completed");
    expect(assetRepo.transitions).toEqual([]);
    expect(storage.readCalls).toEqual([]);
    expect(jobRepo.completed).toBe(true);
  });

  it("completes the job without reprocessing when the asset is already ready", async () => {
    assetRepo.asset = makeAsset({ state: "ready" });

    const result = await useCase.execute({
      assetId: TEST_UUIDS.asset1,
      workerId: "worker-a",
      attemptNumber: 1,
    });

    expect(result.kind).toBe("completed");
    expect(assetRepo.transitions).toEqual([]);
    expect(jobRepo.completed).toBe(true);
  });

  it("resumes a retry attempt when the asset is already in processing", async () => {
    assetRepo.asset = makeAsset({ state: "processing" });

    const result = await useCase.execute({
      assetId: TEST_UUIDS.asset1,
      workerId: "worker-a",
      attemptNumber: 2,
    });

    expect(result.kind).toBe("completed");
    expect(assetRepo.transitions.map((item) => item.toState)).toEqual(["ready"]);
  });

  it("completes the job without processing when the uploaded->processing transition loses its race", async () => {
    assetRepo.transitionResult = false;

    const result = await useCase.execute({
      assetId: TEST_UUIDS.asset1,
      workerId: "worker-a",
      attemptNumber: 1,
    });

    expect(result.kind).toBe("completed");
    expect(assetRepo.transitions).toHaveLength(1);
    expect(storage.readCalls).toEqual([]);
    expect(jobRepo.completed).toBe(true);
  });

  it("skips markCompleted when the terminal transition loses its race", async () => {
    assetRepo.asset = makeAsset({ state: "processing" });
    assetRepo.transitionResult = false; // the only transition attempted is the terminal one

    const result = await useCase.execute({
      assetId: TEST_UUIDS.asset1,
      workerId: "worker-a",
      attemptNumber: 1,
    });

    expect(result.kind).toBe("completed");
    expect(jobRepo.completed).toBe(false);
  });

  it("caps read_object at the policy's max file size", async () => {
    await useCase.execute({ assetId: TEST_UUIDS.asset1, workerId: "worker-a", attemptNumber: 1 });

    expect(storage.readCalls[0]?.maxBytes).toBe(52_428_800);
  });

  it("classifies a recordAnalysis DB failure as a transient error tagged record_analysis", async () => {
    assetRepo.recordAnalysisError = new Error("connection terminated unexpectedly");

    await expect(
      useCase.execute({ assetId: TEST_UUIDS.asset1, workerId: "worker-a", attemptNumber: 1 }),
    ).rejects.toMatchObject({ name: "TransientProcessingError", step: "record_analysis" });
  });

  it("classifies a transition DB failure as a transient error tagged transition_state", async () => {
    assetRepo.transitionError = new Error("connection terminated unexpectedly");

    await expect(
      useCase.execute({ assetId: TEST_UUIDS.asset1, workerId: "worker-a", attemptNumber: 1 }),
    ).rejects.toMatchObject({ name: "TransientProcessingError", step: "transition_state" });
  });

  it("throws ProcessingAbortedError before any work when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      useCase.execute({
        assetId: TEST_UUIDS.asset1,
        workerId: "worker-a",
        attemptNumber: 1,
        signal: controller.signal,
      }),
    ).rejects.toBeInstanceOf(ProcessingAbortedError);
    expect(assetRepo.transitions).toEqual([]);
  });

  it("stops before recording analysis when the signal aborts mid-pipeline", async () => {
    const controller = new AbortController();
    virusScan.onScan = () => controller.abort();

    await expect(
      useCase.execute({
        assetId: TEST_UUIDS.asset1,
        workerId: "worker-a",
        attemptNumber: 1,
        signal: controller.signal,
      }),
    ).rejects.toBeInstanceOf(ProcessingAbortedError);
    expect(assetRepo.analyses).toEqual([]);
  });

  it("does not move bytes to quarantine when the signal aborts after record_analysis but before the move", async () => {
    // The crux of the abort behavior: aborting after record_analysis (so the
    // quarantine decision has already been persisted) must still stop the
    // pipeline before it moves bytes to _quarantined/. Hooking
    // recordAnalysis lets the abort land exactly between those two steps.
    const controller = new AbortController();
    assetRepo.onRecordAnalysis = () => controller.abort();
    virusScan.result = {
      decision: "quarantine",
      reason: "virus_detected",
      analyzer: "virus_scan",
      analyzerVersion: "test",
      findings: { duration_ms: 4 },
    };

    await expect(
      useCase.execute({
        assetId: TEST_UUIDS.asset1,
        workerId: "worker-a",
        attemptNumber: 1,
        signal: controller.signal,
      }),
    ).rejects.toBeInstanceOf(ProcessingAbortedError);

    expect(assetRepo.analyses).toHaveLength(1); // record_analysis did commit
    expect(storage.moveCalls).toEqual([]); // but the byte-move never ran
    expect(assetRepo.transitions.some((item) => item.toState === "quarantined_virus")).toBe(false);
  });

  it("falls back to the quarantined storage key when the primary object is missing on retry", async () => {
    // Simulates a previous attempt that moved the bytes but crashed before the
    // DB transition committed: DB key unchanged, bytes at _quarantined/<key>.
    storage.objects.delete("uploads/test.png");
    storage.objects.set("_quarantined/uploads/test.png", Buffer.from("image-bytes"));
    // The primary object is genuinely gone — objectExists must confirm that
    // before the fallback is allowed to trigger (Fix 1: not-found only).
    storage.existsResult = false;
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
      attemptNumber: 2,
    });

    expect(result.kind).toBe("completed");
    expect(assetRepo.transitions.at(-1)?.toState).toBe("quarantined_virus");
    expect(assetRepo.transitions.at(-1)?.newStorageKey).toBe("_quarantined/uploads/test.png");
    expect(storage.existsCalls).toEqual([
      expect.objectContaining({ storageKey: "uploads/test.png" }),
    ]);
    expect(storage.readCalls.map((call) => call.storageKey)).toEqual([
      "uploads/test.png",
      "_quarantined/uploads/test.png",
    ]);
  });

  it("rethrows the original read_object error unchanged when the primary object still exists", async () => {
    // Primary bytes are absent from the fake's store (so readObjectBytes
    // rejects), but existsResult simulates a real object that IS present in
    // storage and failed to read for another reason (auth/quota/network).
    // The fallback must NOT trigger — masking a non-404 failure by reading
    // unrelated bytes from the quarantined key would be worse than surfacing
    // the original error.
    storage.objects.delete("uploads/test.png");
    storage.objects.set("_quarantined/uploads/test.png", Buffer.from("unrelated-bytes"));
    storage.existsResult = true;

    await expect(
      useCase.execute({ assetId: TEST_UUIDS.asset1, workerId: "worker-a", attemptNumber: 1 }),
    ).rejects.toMatchObject({
      name: "TransientProcessingError",
      step: "read_object",
      cause: expect.objectContaining({
        message: expect.stringContaining('"uploads/test.png"'),
      }),
    });

    // Only the primary key was ever read — no fallback attempt.
    expect(storage.readCalls.map((call) => call.storageKey)).toEqual(["uploads/test.png"]);
    // Only the uploaded->processing transition happened; nothing terminal.
    expect(assetRepo.transitions.map((item) => item.toState)).toEqual(["processing"]);
  });

  it("transitions the asset to processing_failed when the storage binding is missing", async () => {
    // FakeStorageBindingRepository.findById matches on id — give it a binding
    // whose id differs from the asset's storageBindingId.
    storageBindings.binding = makeStorageBinding({ id: "99999999-9999-9999-9999-999999999999" });

    const result = await useCase.execute({
      assetId: TEST_UUIDS.asset1,
      workerId: "worker-a",
      attemptNumber: 1,
    });

    expect(result.kind).toBe("failed");
    const terminal = assetRepo.transitions.at(-1);
    expect(terminal?.toState).toBe("processing_failed");
    expect(terminal?.reason).toBe("storage_binding_not_found");
    expect(jobRepo.failed).toBe(true);
  });
});

class InMemoryAssetProcessingRepository extends AssetProcessingRepositoryPort {
  asset: Asset = makeAsset();
  policy: NamespacePolicy = makePolicy();
  transitionResult = true;
  recordAnalysisError: Error | null = null;
  transitionError: Error | null = null;
  onRecordAnalysis: (() => void) | null = null;
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
    if (this.transitionError) {
      return Promise.reject(this.transitionError);
    }
    this.transitions.push(input);
    if (!this.transitionResult) {
      return Promise.resolve(false);
    }
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
    if (this.recordAnalysisError) {
      return Promise.reject(this.recordAnalysisError);
    }
    this.analyses.push(input);
    this.onRecordAnalysis?.();
    return Promise.resolve();
  }

  updateDerivedMetadata(input: IUpdateDerivedMetadataInput): Promise<void> {
    this.derivedMetadata.push(input);
    return Promise.resolve();
  }

  restartProcessing(): never {
    throw new Error("restartProcessing is not used by ProcessClaimedAssetUseCase tests");
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

  countDueJobs(): never {
    throw new Error("countDueJobs is not used by ProcessClaimedAssetUseCase tests");
  }

  cancelForAsset(): never {
    throw new Error("cancelForAsset is not used by ProcessClaimedAssetUseCase tests");
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
  onScan: (() => void) | null = null;

  scan(input: IVirusScanInput): Promise<IVirusScanResult> {
    void input;
    this.onScan?.();
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
