import { DomainError } from "@/shared/kernel/domain/errors/domain-error.interface";

/**
 * The atomic consume UPDATE inside createUploadedAsset matched no row: the
 * intent was consumed by a concurrent confirm or expired by the orphan
 * sweeper between the caller's read and the transaction (F-P7/F-P8).
 * ConfirmUploadUseCase maps this to the idempotent already-consumed lookup.
 */
export class UploadIntentConsumeConflictError extends DomainError {
  constructor(props: { publicId: string }) {
    super({
      message: `Upload intent "${props.publicId}" could not be consumed: it was already consumed or expired by another actor.`,
      params: { publicId: props.publicId },
    });
  }
}
