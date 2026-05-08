import { DomainError } from "@/shared/kernel/domain/errors/domain-error.interface";

/**
 * Raised when a quarantine-only operation (release / reject) targets an
 * asset whose current state isn't a `quarantined_*` value. Catches replays
 * (the asset was already released or rejected) and operator typos.
 */
export class AssetNotInQuarantineError extends DomainError {
  constructor(props: { publicId: string; currentState: string }) {
    super({
      message: `Asset "${props.publicId}" is not in a quarantine state (current: "${props.currentState}").`,
      params: props,
    });
  }
}
