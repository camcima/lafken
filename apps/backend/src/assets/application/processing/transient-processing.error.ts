import type { ProcessingStepName } from "./processing-evidence";

export type TransientProcessingStep =
  | ProcessingStepName
  | "load_asset"
  | "load_binding"
  | "read_object"
  | "move_to_quarantine"
  | "transition_state"
  | "record_analysis"
  | "update_derived_metadata"
  | "finalize_job";

/**
 * Thrown by ProcessClaimedAssetUseCase when a pipeline step fails transiently
 * (e.g. storage 5xx, sharp processing throws, scanner I/O error). The worker
 * catches this and consults the retry policy. Terminal business decisions
 * (rejected/quarantined) are NOT thrown — the use case returns
 * `{ kind: "completed" }` for those.
 */
export class TransientProcessingError extends Error {
  constructor(
    public readonly step: TransientProcessingStep,
    public readonly cause: unknown,
  ) {
    const message: string = cause instanceof Error ? cause.message : String(cause);
    super(`Transient failure during ${step}: ${message}`);
    this.name = "TransientProcessingError";
  }
}
