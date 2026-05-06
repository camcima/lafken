import { DomainError } from "@/shared/kernel/domain/errors/domain-error.interface";

import type { AssetState } from "../value-objects/asset-state.value-object";

export class AssetNotInProcessingFailedStateError extends DomainError {
  constructor(props: { publicId: string; currentState: AssetState }) {
    super({
      message:
        `Asset with public ID "${props.publicId}" is not in "processing_failed" state ` +
        `(current state: "${props.currentState}") — retry is only valid from a failed processing state`,
      params: props,
    });
  }
}
