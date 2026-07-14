import { DomainError } from "@/shared/kernel/domain/errors/domain-error.interface";

/**
 * Raised when no active preset (system or namespace) matches the requested
 * name — or when the asset's binding / the preview signer cannot produce a
 * URL, which is externally indistinguishable. Controllers map this to 404.
 */
export class ActivePresetNotFoundError extends DomainError {
  constructor(props: { presetName: string }) {
    super({
      message: `No active preset matching "${props.presetName}" was found for this asset's namespace.`,
      params: props,
    });
  }
}
