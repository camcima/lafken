import type {
  IQueueDepthSampler,
  ProcessingReleaseReason,
  ProcessingStep,
  ProcessingStepDecision,
  ProcessingTerminalState,
  UploadProtocol,
} from "@/shared/application/metrics.port";
import { MetricsPort } from "@/shared/application/metrics.port";

export class FakeMetricsPort extends MetricsPort {
  readonly recorded: unknown[] = [];

  recordUploadIntentCreated(_input: { namespaceSlug: string; protocol: UploadProtocol }): void {
    this.recorded.push({ method: "recordUploadIntentCreated", ..._input });
  }

  recordUploadIntentRefreshed(_input: { namespaceSlug: string }): void {
    this.recorded.push({ method: "recordUploadIntentRefreshed", ..._input });
  }

  recordUploadConfirmed(_input: { namespaceSlug: string; state: string }): void {
    this.recorded.push({ method: "recordUploadConfirmed", ..._input });
  }

  recordUploadIntentExpiredSwept(_input: { namespaceSlug: string }): void {
    this.recorded.push({ method: "recordUploadIntentExpiredSwept", ..._input });
  }

  recordProcessingJobClaimed(): void {
    this.recorded.push({ method: "recordProcessingJobClaimed" });
  }

  recordProcessingJobReleased(_input: { reason: ProcessingReleaseReason }): void {
    this.recorded.push({ method: "recordProcessingJobReleased", ..._input });
  }

  recordProcessingStepDuration(_input: {
    step: ProcessingStep;
    decision: ProcessingStepDecision;
    durationMs: number;
  }): void {
    this.recorded.push({ method: "recordProcessingStepDuration", ..._input });
  }

  recordProcessingStepOutcome(_input: {
    step: ProcessingStep;
    decision: ProcessingStepDecision;
  }): void {
    this.recorded.push({ method: "recordProcessingStepOutcome", ..._input });
  }

  recordProcessingRetry(_input: { errorClass: string }): void {
    this.recorded.push({ method: "recordProcessingRetry", ..._input });
  }

  recordProcessingWorkflowTimeout(): void {
    this.recorded.push({ method: "recordProcessingWorkflowTimeout" });
  }

  recordProcessingTerminalState(_input: { state: ProcessingTerminalState }): void {
    this.recorded.push({ method: "recordProcessingTerminalState", ..._input });
  }

  recordProcessingStaleClaimReclaimed(_input: { count: number }): void {
    this.recorded.push({ method: "recordProcessingStaleClaimReclaimed", ..._input });
  }

  recordPreviewUrlIssued(_input: { namespaceSlug: string; presetName: string }): void {
    this.recorded.push({ method: "recordPreviewUrlIssued", ..._input });
  }

  recordPreviewUrlDuration(_input: {
    namespaceSlug: string;
    presetName: string;
    durationMs: number;
  }): void {
    this.recorded.push({ method: "recordPreviewUrlDuration", ..._input });
  }

  recordDownloadUrlIssued(_input: { namespaceSlug: string }): void {
    this.recorded.push({ method: "recordDownloadUrlIssued", ..._input });
  }

  registerQueueDepthSampler(_sampler: IQueueDepthSampler): void {
    this.recorded.push({ method: "registerQueueDepthSampler" });
  }
}
