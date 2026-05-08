import { DomainError } from "@/shared/kernel/domain/errors/domain-error.interface";

/**
 * Raised when a state-changing operation (delete, release from quarantine,
 * reject, etc.) is attempted on an asset whose `legal_hold` flag is set.
 * Operators must lift the hold before any further mutation.
 */
export class AssetUnderLegalHoldError extends DomainError {
  constructor(props: { publicId: string; operation?: string }) {
    const op = props.operation ?? "modified";
    super({
      message: `Asset "${props.publicId}" is under legal hold and cannot be ${op}.`,
      params: props,
    });
  }
}
