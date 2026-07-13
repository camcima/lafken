import { QUARANTINED_ASSET_STATES } from "@/assets/domain/value-objects/asset-state.value-object";
import type { AssetState } from "@/assets/domain/value-objects/asset-state.value-object";
import { calculateDurationMs } from "@/shared/kernel/domain/duration";

export { calculateDurationMs };

export type ProcessingStepName =
  | "virus_scan"
  | "magic_byte_detection"
  | "image_inspection"
  | "content_moderation";

export interface IMakeStepTimingInput {
  step: ProcessingStepName;
  startedAt: Date;
  finishedAt: Date;
  decision: string;
}

export interface ITransitionMetadataInput {
  workerId: string;
  attemptNumber: number;
  reasonCode: string;
  step?: ProcessingStepName;
  durationMs?: number;
  totalDurationMs?: number;
  steps?: IStepTiming[];
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
  reason_code: string;
  step?: ProcessingStepName;
  duration_ms?: number;
  total_duration_ms?: number;
  steps?: IStepTiming[];
}

const TERMINAL_ASSET_STATES: readonly AssetState[] = [
  "ready",
  "rejected",
  ...QUARANTINED_ASSET_STATES,
  "processing_failed",
  "expired",
  "deleted",
];

export function makeStepTiming(input: IMakeStepTimingInput): IStepTiming {
  const durationMs: number = calculateDurationMs(input.startedAt, input.finishedAt);

  return {
    step: input.step,
    started_at: input.startedAt.toISOString(),
    finished_at: input.finishedAt.toISOString(),
    duration_ms: durationMs,
    decision: input.decision,
  };
}

export function makeTransitionMetadata(input: ITransitionMetadataInput): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    worker_id: input.workerId,
    job_attempt: input.attemptNumber,
    reason_code: input.reasonCode,
  };

  if (input.step !== undefined) {
    metadata.step = input.step;
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
