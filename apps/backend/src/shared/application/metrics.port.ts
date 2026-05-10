export type ProcessingStep =
  | "virus_scan"
  | "magic_byte_detection"
  | "image_inspection"
  | "content_moderation"
  | "exif_strip"
  | "thumbnail_generation"
  | "metadata_extraction";

export type ProcessingStepDecision = "pass" | "fail" | "error" | "quarantine" | "transient";

export type UploadProtocol = "simple" | "tus";

export type ProcessingTerminalState =
  | "ready"
  | "quarantined_virus"
  | "quarantined_moderation"
  | "rejected"
  | "processing_failed";

export type ProcessingReleaseReason =
  | "transient_error"
  | "max_attempts"
  | "workflow_timeout"
  | "worker_shutdown";

export interface IQueueDepthSampler {
  (): Promise<number>;
}

export abstract class MetricsPort {
  abstract recordUploadIntentCreated(input: {
    namespaceSlug: string;
    protocol: UploadProtocol;
  }): void;

  abstract recordUploadIntentRefreshed(input: { namespaceSlug: string }): void;

  abstract recordUploadConfirmed(input: { namespaceSlug: string; state: string }): void;

  abstract recordUploadIntentExpiredSwept(input: { namespaceSlug: string }): void;

  abstract recordProcessingJobClaimed(): void;

  abstract recordProcessingJobReleased(input: { reason: ProcessingReleaseReason }): void;

  abstract recordProcessingStepDuration(input: {
    step: ProcessingStep;
    decision: ProcessingStepDecision;
    durationMs: number;
  }): void;

  abstract recordProcessingStepOutcome(input: {
    step: ProcessingStep;
    decision: ProcessingStepDecision;
  }): void;

  abstract recordProcessingRetry(input: { errorClass: string }): void;

  abstract recordProcessingWorkflowTimeout(): void;

  abstract recordProcessingTerminalState(input: { state: ProcessingTerminalState }): void;

  abstract recordProcessingStaleClaimReclaimed(input: { count: number }): void;

  abstract registerQueueDepthSampler(sampler: IQueueDepthSampler): void;
}
