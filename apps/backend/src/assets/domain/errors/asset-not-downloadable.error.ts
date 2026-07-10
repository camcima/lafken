import { DomainError } from "@/shared/kernel/domain/errors/domain-error.interface";

/**
 * Raised when a download URL is requested for an asset whose state does not
 * allow serving its original bytes (pending / quarantined / rejected /
 * processing_failed / expired / deleted). Closes the quarantine bypass where
 * a signed URL minted for `storage_key` would resolve to the moved
 * `_quarantined/<key>` bytes (implementation review F-S1).
 */
export class AssetNotDownloadableError extends DomainError {
  constructor(props: { publicId: string; currentState: string }) {
    super({
      message: `Asset "${props.publicId}" is not in a downloadable state (current: "${props.currentState}").`,
      params: props,
    });
  }
}
