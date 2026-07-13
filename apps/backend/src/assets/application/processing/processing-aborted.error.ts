import type { TransientProcessingStep } from "./transient-processing.error";

/**
 * Thrown by ProcessClaimedAssetUseCase when the worker's workflow timeout has
 * aborted the run: checked before every step so a raced-out pipeline stops
 * writing analyses / metadata / transitions and never moves bytes it can no
 * longer account for (F-P5). Deliberately NOT a TransientProcessingError —
 * the worker has already marked the asset processing_failed by the time this
 * fires; the rejection is logged and swallowed.
 */
export class ProcessingAbortedError extends Error {
  constructor(public readonly step: TransientProcessingStep) {
    super(`Processing aborted before step "${step}" (workflow timeout)`);
    this.name = "ProcessingAbortedError";
  }
}
