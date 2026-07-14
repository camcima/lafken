import { DomainError } from "@/shared/kernel/domain/errors/domain-error.interface";

/**
 * Raised when a preview URL is requested for an asset whose state is not in
 * the previewable allow-list (quarantined / rejected / deleted / expired).
 * Controllers map this to 404 so callers can't distinguish "hidden" from
 * "absent".
 */
export class AssetNotPreviewableError extends DomainError {
  constructor(props: { publicId: string; currentState: string }) {
    super({
      message: `Asset "${props.publicId}" is not in a previewable state (current: "${props.currentState}").`,
      params: props,
    });
  }
}
