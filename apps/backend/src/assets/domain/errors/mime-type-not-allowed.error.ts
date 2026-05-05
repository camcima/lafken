import { DomainError } from "@/shared/kernel/domain/errors/domain-error.interface";

export class MimeTypeNotAllowedError extends DomainError {
  public readonly namespaceSlug: string;
  public readonly declaredMimeType: string;
  public readonly allowedMimeTypes: string[];

  constructor(props: {
    namespaceSlug: string;
    declaredMimeType: string;
    allowedMimeTypes: string[];
  }) {
    super({
      message: `MIME type "${props.declaredMimeType}" is not allowed in namespace "${props.namespaceSlug}". Allowed: ${props.allowedMimeTypes.join(", ")}.`,
      params: props,
    });
    this.namespaceSlug = props.namespaceSlug;
    this.declaredMimeType = props.declaredMimeType;
    this.allowedMimeTypes = props.allowedMimeTypes;
  }
}
