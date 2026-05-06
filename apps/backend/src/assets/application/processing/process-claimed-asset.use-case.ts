import { Injectable } from "@nestjs/common";
import { createActor } from "xstate";

import { AssetProcessingRepositoryPort } from "@/assets/domain/repositories/asset-processing.repository.port";
import { ProcessingJobRepositoryPort } from "@/assets/domain/repositories/processing-job.repository.port";
import { AssetStoragePort } from "@/assets/domain/services/asset-storage.service.port";
import { ContentModerationPort } from "@/assets/domain/services/content-moderation.service.port";
import { ImageInspectionPort } from "@/assets/domain/services/image-inspection.service.port";
import { VirusScanPort } from "@/assets/domain/services/virus-scan.service.port";
import type { AssetState } from "@/assets/domain/value-objects/asset-state.value-object";
import { AppLoggerPort } from "@/shared/application/app-logger.port";
import { StorageBindingQueryRepositoryPort } from "@/system/domain/repositories/storage-binding-query.repository.port";

import { assetProcessingMachine } from "./asset-processing-machine";
import {
  calculateDurationMs,
  makeTransitionMetadata,
  type ProcessingStepName,
} from "./processing-evidence";

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
    private readonly storageBindingRepo: StorageBindingQueryRepositoryPort,
    private readonly logger: AppLoggerPort,
  ) {
    this.logger.setContext(ProcessClaimedAssetUseCase.name);
  }

  async execute(input: IProcessClaimedAssetInput): Promise<ProcessClaimedAssetResult> {
    this.logger.info(
      { assetId: input.assetId, attemptNumber: input.attemptNumber, workerId: input.workerId },
      "processing started",
    );
    const machine = createActor(assetProcessingMachine).start();
    const loaded = await this.assetRepo.findAssetWithPolicy(input.assetId);
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

    const binding = await this.storageBindingRepo.findById(asset.props.storageBindingId);
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
    const bytes: Buffer = await this.assetStorage.readObjectBytes({
      binding: { bucket: gcs.bucket, projectId: gcs.projectId },
      storageKey: asset.props.storageKey,
    });

    const inspectionStartedAt: Date = new Date();
    const inspection = await this.imageInspection.inspect({
      bytes,
      declaredMimeType: asset.props.declaredMimeType,
      allowedMimeTypes: policy.props.allowedMimeTypes,
    });
    this.logger.info(
      {
        assetId: asset.props.id,
        step: "image_inspection",
        decision: inspection.decision,
        durationMs: calculateDurationMs(inspectionStartedAt, new Date()),
      },
      "step completed",
    );
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

    const scanStartedAt: Date = new Date();
    const scan = await this.virusScan.scan({ bytes, contentHash: inspection.contentHash });
    this.logger.info(
      {
        assetId: asset.props.id,
        step: "virus_scan",
        decision: scan.decision,
        durationMs: calculateDurationMs(scanStartedAt, new Date()),
      },
      "step completed",
    );
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
      });
      return { kind: "completed" };
    }

    machine.send({ type: "VIRUS_CLEAN" });
    if (policy.props.contentModeration) {
      machine.send({ type: "MODERATION_REQUIRED" });
      const moderationStartedAt: Date = new Date();
      const moderation = await this.moderation.analyze({
        bytes,
        policyConfig: policy.props.contentModeration,
      });
      this.logger.info(
        {
          assetId: asset.props.id,
          step: "content_moderation",
          decision: moderation.decision,
          durationMs: calculateDurationMs(moderationStartedAt, new Date()),
        },
        "step completed",
      );
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
    await this.transitionToTerminal({
      assetId: asset.props.id,
      fromState: currentState,
      toState: "ready",
      reason: "processing_completed",
      workerId: input.workerId,
      attemptNumber: input.attemptNumber,
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
    });
    await this.jobRepo.markCompleted({
      assetId: input.assetId,
      workerId: input.workerId,
      now: new Date(),
    });
  }

  private durationFromFindings(findings: Record<string, unknown>): number {
    const durationMs: unknown = findings["duration_ms"];
    return typeof durationMs === "number" ? durationMs : DEFAULT_DURATION_MS;
  }

  private workerActor(workerId: string): string {
    return `worker:${workerId}`;
  }
}
