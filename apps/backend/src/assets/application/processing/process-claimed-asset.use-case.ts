import { createHash } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { createActor } from "xstate";

import { AssetProcessingRepositoryPort } from "@/assets/domain/repositories/asset-processing.repository.port";
import { ProcessingJobRepositoryPort } from "@/assets/domain/repositories/processing-job.repository.port";
import { AssetStoragePort } from "@/assets/domain/services/asset-storage.service.port";
import { ContentModerationPort } from "@/assets/domain/services/content-moderation.service.port";
import { ImageInspectionPort } from "@/assets/domain/services/image-inspection.service.port";
import { MimeSniffPort } from "@/assets/domain/services/mime-sniff.service.port";
import { VirusScanPort } from "@/assets/domain/services/virus-scan.service.port";
import {
  type AssetState,
  QUARANTINE_KEY_PREFIX,
  toQuarantinedStorageKey,
} from "@/assets/domain/value-objects/asset-state.value-object";
import { AppLoggerPort } from "@/shared/application/app-logger.port";
import {
  MetricsPort,
  type ProcessingStep,
  type ProcessingStepDecision,
  type ProcessingTerminalState,
} from "@/shared/application/metrics.port";
import { StorageBindingQueryRepositoryPort } from "@/system/domain/repositories/storage-binding-query.repository.port";

import { assetProcessingMachine } from "./asset-processing-machine";
import {
  calculateDurationMs,
  type IStepTiming,
  makeStepTiming,
  makeTransitionMetadata,
  type ProcessingStepName,
} from "./processing-evidence";
import {
  TransientProcessingError,
  type TransientProcessingStep,
} from "./transient-processing.error";

export interface IProcessClaimedAssetInput {
  assetId: string;
  workerId: string;
  attemptNumber: number;
}

export type ProcessClaimedAssetResult =
  | { kind: "completed" }
  | { kind: "retry_released" }
  | { kind: "failed" };

const FALLBACK_MIME_TYPE = "application/octet-stream";
const DEFAULT_DURATION_MS = 0;

@Injectable()
export class ProcessClaimedAssetUseCase {
  constructor(
    private readonly assetRepo: AssetProcessingRepositoryPort,
    private readonly jobRepo: ProcessingJobRepositoryPort,
    private readonly assetStorage: AssetStoragePort,
    private readonly imageInspection: ImageInspectionPort,
    private readonly virusScan: VirusScanPort,
    private readonly moderation: ContentModerationPort,
    private readonly mimeSniff: MimeSniffPort,
    private readonly storageBindingRepo: StorageBindingQueryRepositoryPort,
    private readonly logger: AppLoggerPort,
    private readonly metrics: MetricsPort,
  ) {
    this.logger.setContext(ProcessClaimedAssetUseCase.name);
  }

  async execute(input: IProcessClaimedAssetInput): Promise<ProcessClaimedAssetResult> {
    this.logger.info(
      { assetId: input.assetId, attemptNumber: input.attemptNumber, workerId: input.workerId },
      "processing started",
    );
    const machine = createActor(assetProcessingMachine).start();
    const loaded = await this.runStep("load_asset", () =>
      this.assetRepo.findAssetWithPolicy(input.assetId),
    );
    if (!loaded) {
      this.logger.warn(
        { assetId: input.assetId },
        "asset not found while processing; marking job failed",
      );
      machine.send({ type: "FAILED" });
      await this.jobRepo.markFailed({
        assetId: input.assetId,
        workerId: input.workerId,
        lastError: "asset_not_found",
        now: new Date(),
      });
      return { kind: "failed" };
    }

    const { asset, policy } = loaded;
    const processingStartedAt: Date = new Date();
    const stepTimings: IStepTiming[] = [];
    let currentState: AssetState = asset.props.state;
    if (currentState === "uploaded") {
      await this.assetRepo.transitionAsset({
        assetId: asset.props.id,
        fromState: "uploaded",
        toState: "processing",
        reason: "processing_started",
        metadata: makeTransitionMetadata({
          workerId: input.workerId,
          attemptNumber: input.attemptNumber,
          reasonCode: "processing_started",
        }),
        occurredBy: this.workerActor(input.workerId),
        now: new Date(),
      });
      currentState = "processing";
    }

    const binding = await this.runStep("load_binding", () =>
      this.storageBindingRepo.findById(asset.props.storageBindingId),
    );
    if (!binding) {
      this.logger.warn(
        { assetId: asset.props.id, storageBindingId: asset.props.storageBindingId },
        "storage binding not found; marking job failed",
      );
      machine.send({ type: "FAILED" });
      await this.jobRepo.markFailed({
        assetId: asset.props.id,
        workerId: input.workerId,
        lastError: "storage_binding_not_found",
        now: new Date(),
      });
      return { kind: "failed" };
    }

    const gcs = binding.getGcsConfig();
    const bytes: Buffer = await this.runStep("read_object", () =>
      this.assetStorage.readObjectBytes({
        binding: { bucket: gcs.bucket, projectId: gcs.projectId },
        storageKey: asset.props.storageKey,
      }),
    );
    // Pre-computed for virus_scan evidence so we don't have to wait for
    // image_inspection (which runs after virus_scan and would otherwise be
    // the only producer of contentHash). Same SHA-256 the inspection step
    // would derive itself, so the two analyses agree on hash.
    const contentHash: Buffer = createHash("sha256").update(bytes).digest();

    await this.recordCurrentStep({
      assetId: asset.props.id,
      workerId: input.workerId,
      currentStep: "virus_scan",
    });
    const scanStartedAt: Date = new Date();
    const scan = await this.runStep("virus_scan", () =>
      this.virusScan.scan({ bytes, contentHash }),
    );
    const scanFinishedAt: Date = new Date();
    stepTimings.push(
      makeStepTiming({
        step: "virus_scan",
        startedAt: scanStartedAt,
        finishedAt: scanFinishedAt,
        decision: scan.decision,
      }),
    );
    this.logger.info(
      {
        assetId: asset.props.id,
        step: "virus_scan",
        decision: scan.decision,
        durationMs: calculateDurationMs(scanStartedAt, scanFinishedAt),
      },
      "step completed",
    );
    this.recordStepMetric({
      step: "virus_scan",
      decision: scan.decision,
      durationMs: calculateDurationMs(scanStartedAt, scanFinishedAt),
    });
    await this.assetRepo.recordAnalysis({
      assetId: asset.props.id,
      analyzer: scan.analyzer,
      analyzerVersion: scan.analyzerVersion,
      decision: scan.decision,
      findings: scan.findings,
      occurredAt: new Date(),
    });

    if (scan.decision === "quarantine") {
      machine.send({ type: "VIRUS_INFECTED" });
      const reason: string = scan.reason ?? "virus_detected";
      const newStorageKey: string | undefined = await this.moveBytesToQuarantine({
        binding: { bucket: gcs.bucket, projectId: gcs.projectId },
        storageKey: asset.props.storageKey,
      });
      this.logger.info(
        { assetId: asset.props.id, toState: "quarantined_virus", reason },
        "transitioning to terminal state",
      );
      await this.transitionToTerminal({
        assetId: asset.props.id,
        fromState: currentState,
        toState: "quarantined_virus",
        reason,
        workerId: input.workerId,
        attemptNumber: input.attemptNumber,
        step: "virus_scan",
        durationMs: this.durationFromFindings(scan.findings),
        newStorageKey,
      });
      return { kind: "completed" };
    }

    machine.send({ type: "VIRUS_CLEAN" });

    await this.recordCurrentStep({
      assetId: asset.props.id,
      workerId: input.workerId,
      currentStep: "magic_byte_detection",
    });
    const sniffStartedAt: Date = new Date();
    const sniffedMimeType: string | null = await this.runStep("magic_byte_detection", () =>
      this.mimeSniff.sniff(bytes),
    );
    const sniffFinishedAt: Date = new Date();
    const sniffDecision: "pass" | "error" = sniffedMimeType === null ? "error" : "pass";
    stepTimings.push(
      makeStepTiming({
        step: "magic_byte_detection",
        startedAt: sniffStartedAt,
        finishedAt: sniffFinishedAt,
        decision: sniffDecision,
      }),
    );
    this.recordStepMetric({
      step: "magic_byte_detection",
      decision: sniffDecision,
      durationMs: calculateDurationMs(sniffStartedAt, sniffFinishedAt),
    });

    if (sniffedMimeType === null) {
      machine.send({ type: "MIME_INVALID" });
      const reason: string = "unrecognized_format";
      this.logger.info(
        { assetId: asset.props.id, toState: "rejected", reason },
        "transitioning to terminal state",
      );
      await this.transitionToTerminal({
        assetId: asset.props.id,
        fromState: currentState,
        toState: "rejected",
        reason,
        workerId: input.workerId,
        attemptNumber: input.attemptNumber,
        step: "magic_byte_detection",
        durationMs: calculateDurationMs(sniffStartedAt, sniffFinishedAt),
      });
      return { kind: "completed" };
    }
    if (!policy.props.allowedMimeTypes.includes(sniffedMimeType)) {
      machine.send({ type: "MIME_INVALID" });
      const reason: string = "mime_type_not_allowed";
      this.logger.info(
        { assetId: asset.props.id, toState: "rejected", reason, sniffedMimeType },
        "transitioning to terminal state",
      );
      await this.transitionToTerminal({
        assetId: asset.props.id,
        fromState: currentState,
        toState: "rejected",
        reason,
        workerId: input.workerId,
        attemptNumber: input.attemptNumber,
        step: "magic_byte_detection",
        durationMs: calculateDurationMs(sniffStartedAt, sniffFinishedAt),
      });
      return { kind: "completed" };
    }
    machine.send({ type: "MIME_VALID" });

    await this.recordCurrentStep({
      assetId: asset.props.id,
      workerId: input.workerId,
      currentStep: "image_inspection",
    });
    const inspectionStartedAt: Date = new Date();
    const inspection = await this.runStep("image_inspection", () =>
      this.imageInspection.inspect({
        bytes,
        declaredMimeType: asset.props.declaredMimeType,
        sniffedMimeType,
        allowedMimeTypes: policy.props.allowedMimeTypes,
      }),
    );
    const inspectionFinishedAt: Date = new Date();
    stepTimings.push(
      makeStepTiming({
        step: "image_inspection",
        startedAt: inspectionStartedAt,
        finishedAt: inspectionFinishedAt,
        decision: inspection.decision,
      }),
    );
    this.logger.info(
      {
        assetId: asset.props.id,
        step: "image_inspection",
        decision: inspection.decision,
        durationMs: calculateDurationMs(inspectionStartedAt, inspectionFinishedAt),
      },
      "step completed",
    );
    this.recordStepMetric({
      step: "image_inspection",
      decision: inspection.decision,
      durationMs: calculateDurationMs(inspectionStartedAt, inspectionFinishedAt),
    });
    await this.assetRepo.recordAnalysis({
      assetId: asset.props.id,
      analyzer: inspection.analyzer,
      analyzerVersion: inspection.analyzerVersion,
      decision: inspection.decision,
      findings: inspection.findings,
      occurredAt: new Date(),
    });

    if (inspection.decision === "error") {
      machine.send({ type: "IMAGE_INVALID" });
      const reason: string = inspection.reason ?? "invalid_image_format";
      this.logger.info(
        { assetId: asset.props.id, toState: "rejected", reason },
        "transitioning to terminal state",
      );
      await this.transitionToTerminal({
        assetId: asset.props.id,
        fromState: currentState,
        toState: "rejected",
        reason,
        workerId: input.workerId,
        attemptNumber: input.attemptNumber,
        step: "image_inspection",
        durationMs: this.durationFromFindings(inspection.findings),
      });
      return { kind: "completed" };
    }

    machine.send({ type: "IMAGE_VALID" });
    await this.assetRepo.updateDerivedMetadata({
      assetId: asset.props.id,
      mimeType: inspection.actualMimeType ?? asset.props.declaredMimeType ?? FALLBACK_MIME_TYPE,
      sizeBytes: inspection.sizeBytes,
      width: inspection.width,
      height: inspection.height,
      contentHash: inspection.contentHash,
      captureContext: inspection.captureContext,
    });

    const moderationConfig = policy.props.contentModeration;
    if (moderationConfig) {
      machine.send({ type: "MODERATION_REQUIRED" });
      await this.recordCurrentStep({
        assetId: asset.props.id,
        workerId: input.workerId,
        currentStep: "content_moderation",
      });
      const moderationStartedAt: Date = new Date();
      const moderation = await this.runStep("content_moderation", () =>
        this.moderation.analyze({
          bytes,
          policyConfig: moderationConfig,
        }),
      );
      const moderationFinishedAt: Date = new Date();
      stepTimings.push(
        makeStepTiming({
          step: "content_moderation",
          startedAt: moderationStartedAt,
          finishedAt: moderationFinishedAt,
          decision: moderation.decision,
        }),
      );
      this.logger.info(
        {
          assetId: asset.props.id,
          step: "content_moderation",
          decision: moderation.decision,
          durationMs: calculateDurationMs(moderationStartedAt, moderationFinishedAt),
        },
        "step completed",
      );
      this.recordStepMetric({
        step: "content_moderation",
        decision: moderation.decision,
        durationMs: calculateDurationMs(moderationStartedAt, moderationFinishedAt),
      });
      await this.assetRepo.recordAnalysis({
        assetId: asset.props.id,
        analyzer: moderation.analyzer,
        analyzerVersion: moderation.analyzerVersion,
        decision: moderation.decision,
        findings: moderation.findings,
        occurredAt: new Date(),
      });
      if (moderation.decision === "quarantine") {
        machine.send({ type: "MODERATION_QUARANTINE" });
        const reason: string = moderation.reason ?? "moderation_quarantined";
        const newStorageKey: string | undefined = await this.moveBytesToQuarantine({
          binding: { bucket: gcs.bucket, projectId: gcs.projectId },
          storageKey: asset.props.storageKey,
        });
        this.logger.info(
          { assetId: asset.props.id, toState: "quarantined_moderation", reason },
          "transitioning to terminal state",
        );
        await this.transitionToTerminal({
          assetId: asset.props.id,
          fromState: currentState,
          toState: "quarantined_moderation",
          reason,
          workerId: input.workerId,
          attemptNumber: input.attemptNumber,
          step: "content_moderation",
          durationMs: this.durationFromFindings(moderation.findings),
          newStorageKey,
        });
        return { kind: "completed" };
      }
      machine.send({ type: "MODERATION_PASS" });
    } else {
      machine.send({ type: "MODERATION_PASS" });
    }

    this.logger.info(
      { assetId: asset.props.id, toState: "ready", reason: "processing_completed" },
      "transitioning to terminal state",
    );
    await this.transitionToReady({
      assetId: asset.props.id,
      fromState: currentState,
      workerId: input.workerId,
      attemptNumber: input.attemptNumber,
      processingStartedAt,
      stepTimings,
    });
    return { kind: "completed" };
  }

  private async transitionToTerminal(input: {
    assetId: string;
    fromState: AssetState;
    toState: AssetState;
    reason: string;
    workerId: string;
    attemptNumber: number;
    step?: ProcessingStepName;
    durationMs?: number;
    newStorageKey?: string;
  }): Promise<void> {
    await this.assetRepo.transitionAsset({
      assetId: input.assetId,
      fromState: input.fromState,
      toState: input.toState,
      reason: input.reason,
      metadata: makeTransitionMetadata({
        workerId: input.workerId,
        attemptNumber: input.attemptNumber,
        step: input.step,
        reasonCode: input.reason,
        durationMs: input.durationMs,
      }),
      occurredBy: this.workerActor(input.workerId),
      now: new Date(),
      newStorageKey: input.newStorageKey,
    });
    this.metrics.recordProcessingTerminalState({ state: input.toState as ProcessingTerminalState });
    await this.jobRepo.markCompleted({
      assetId: input.assetId,
      workerId: input.workerId,
      now: new Date(),
    });
  }

  /**
   * Moves the source bytes from `<key>` to `_quarantined/<key>` and returns
   * the new key, so the DB transition can update `storage_key` in the same
   * UPDATE. Skips the move when bytes are already at the quarantined path —
   * this happens when a previous attempt completed the move but failed before
   * the DB transition committed (worker retry path). The adapter's
   * `moveObject` is itself idempotent on (source missing, target present).
   *
   * Wrapped in `runStep("move_to_quarantine", …)` so a transient storage
   * error becomes a TransientProcessingError and triggers retry rather than
   * leaving the bytes accessible to imgproxy.
   */
  private async moveBytesToQuarantine(input: {
    binding: { bucket: string; projectId: string };
    storageKey: string;
  }): Promise<string | undefined> {
    if (input.storageKey.startsWith(QUARANTINE_KEY_PREFIX)) {
      return undefined;
    }
    const newStorageKey: string = toQuarantinedStorageKey(input.storageKey);
    await this.runStep("move_to_quarantine", () =>
      this.assetStorage.moveObject({
        binding: input.binding,
        fromKey: input.storageKey,
        toKey: newStorageKey,
      }),
    );
    return newStorageKey;
  }

  /**
   * Success-path terminal transition. Aggregates per-step timings into the
   * transition metadata so the audit trail records every stage's duration and
   * the wall-clock total — required by the processing spec for `ready`.
   */
  private async transitionToReady(input: {
    assetId: string;
    fromState: AssetState;
    workerId: string;
    attemptNumber: number;
    processingStartedAt: Date;
    stepTimings: IStepTiming[];
  }): Promise<void> {
    const reason: string = "processing_completed";
    const finishedAt: Date = new Date();
    await this.assetRepo.transitionAsset({
      assetId: input.assetId,
      fromState: input.fromState,
      toState: "ready",
      reason,
      metadata: makeTransitionMetadata({
        workerId: input.workerId,
        attemptNumber: input.attemptNumber,
        reasonCode: reason,
        totalDurationMs: calculateDurationMs(input.processingStartedAt, finishedAt),
        steps: input.stepTimings,
      }),
      occurredBy: this.workerActor(input.workerId),
      now: finishedAt,
    });
    this.metrics.recordProcessingTerminalState({ state: "ready" });
    await this.jobRepo.markCompleted({
      assetId: input.assetId,
      workerId: input.workerId,
      now: finishedAt,
    });
  }

  private durationFromFindings(findings: Record<string, unknown>): number {
    const durationMs: unknown = findings["duration_ms"];
    return typeof durationMs === "number" ? durationMs : DEFAULT_DURATION_MS;
  }

  /**
   * Updates the job's `current_step` so operators can see which pipeline stage
   * the worker is executing. A `false` return means the row was either
   * reclaimed by another worker (stale-claim recovery) or already terminal —
   * we log a warning and continue; the subsequent step will fail naturally if
   * the claim is truly lost.
   */
  private async recordCurrentStep(input: {
    assetId: string;
    workerId: string;
    currentStep: ProcessingStepName;
  }): Promise<void> {
    const updated: boolean = await this.jobRepo.updateCurrentStep({
      assetId: input.assetId,
      workerId: input.workerId,
      now: new Date(),
      currentStep: input.currentStep,
    });
    if (!updated) {
      this.logger.warn(
        {
          assetId: input.assetId,
          workerId: input.workerId,
          currentStep: input.currentStep,
        },
        "current_step update did not affect any row",
      );
    }
  }

  private workerActor(workerId: string): string {
    return `worker:${workerId}`;
  }

  /**
   * Wraps a port call so that any thrown error becomes a TransientProcessingError
   * tagged with the step that failed. The worker catches this and consults the
   * retry policy. Business decisions (e.g. inspection.decision === "error",
   * scan.decision === "quarantine") are NOT wrapped — they return normally.
   */
  private async runStep<T>(step: TransientProcessingStep, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      throw new TransientProcessingError(step, err);
    }
  }

  /**
   * Single emission point for `lafken.processing.step.duration` (histogram) and
   * `lafken.processing.step.outcome` (counter). Keeps attribute keys on the
   * §5.2 allow-list — `step` and `decision` are both bounded.
   */
  private recordStepMetric(input: {
    step: ProcessingStepName;
    decision: string;
    durationMs: number;
  }): void {
    this.metrics.recordProcessingStepDuration({
      step: input.step as ProcessingStep,
      decision: input.decision as ProcessingStepDecision,
      durationMs: input.durationMs,
    });
    this.metrics.recordProcessingStepOutcome({
      step: input.step as ProcessingStep,
      decision: input.decision as ProcessingStepDecision,
    });
  }
}
