import type { AssetState } from "@/assets/domain/value-objects/asset-state.value-object";

export type ProcessingStepName = "image_inspection" | "virus_scan" | "content_moderation";

export interface IStepTimingInput {
  step: ProcessingStepName;
  startedAt: Date;
  finishedAt: Date;
  decision: string;
}

export interface ITransitionMetadataInput {
  workerId: string;
  attemptNumber: number;
  step?: ProcessingStepName;
  reasonCode?: string;
  durationMs?: number;
  totalDurationMs?: number;
  steps?: Record<string, unknown>[];
}

export interface IStepTiming {
  step: ProcessingStepName;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  decision: string;
}

export interface ITransitionMetadata {
  worker_id: string;
  job_attempt: number;
  step?: ProcessingStepName;
  reason_code?: string;
  duration_ms?: number;
  total_duration_ms?: number;
  steps?: Record<string, unknown>[];
}

const TERMINAL_ASSET_STATES: readonly AssetState[] = [
  "ready",
  "rejected",
  "quarantined_virus",
  "quarantined_moderation",
  "processing_failed",
];

export function calculateDurationMs(startedAt: Date, finishedAt: Date): number {
  const durationMs: number = finishedAt.getTime() - startedAt.getTime();
  return Math.max(0, durationMs);
}

export function makeStepTiming(input: IStepTimingInput): IStepTiming {
  const durationMs: number = calculateDurationMs(input.startedAt, input.finishedAt);

  return {
    step: input.step,
    started_at: input.startedAt.toISOString(),
    finished_at: input.finishedAt.toISOString(),
    duration_ms: durationMs,
    decision: input.decision,
  };
}

export function makeTransitionMetadata(input: ITransitionMetadataInput): ITransitionMetadata {
  const metadata: ITransitionMetadata = {
    worker_id: input.workerId,
    job_attempt: input.attemptNumber,
  };

  if (input.step !== undefined) {
    metadata.step = input.step;
  }

  if (input.reasonCode !== undefined) {
    metadata.reason_code = input.reasonCode;
  }

  if (input.durationMs !== undefined) {
    metadata.duration_ms = input.durationMs;
  }

  if (input.totalDurationMs !== undefined) {
    metadata.total_duration_ms = input.totalDurationMs;
  }

  if (input.steps !== undefined) {
    metadata.steps = input.steps;
  }

  return metadata;
}

export function isTerminalAssetState(state: AssetState): boolean {
  return TERMINAL_ASSET_STATES.includes(state);
}
