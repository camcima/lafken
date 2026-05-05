import { DomainError } from "@/shared/kernel/domain/errors/domain-error.interface";

export class FileSizeExceedsPolicyError extends DomainError {
  public readonly namespaceSlug: string;
  public readonly declaredSizeBytes: bigint;
  public readonly maxFileSizeBytes: bigint;

  constructor(props: {
    namespaceSlug: string;
    declaredSizeBytes: bigint;
    maxFileSizeBytes: bigint;
  }) {
    super({
      message: `Declared file size ${props.declaredSizeBytes.toString()} bytes exceeds policy maximum ${props.maxFileSizeBytes.toString()} bytes for namespace "${props.namespaceSlug}".`,
      params: {
        namespaceSlug: props.namespaceSlug,
        declaredSizeBytes: props.declaredSizeBytes.toString(),
        maxFileSizeBytes: props.maxFileSizeBytes.toString(),
      },
    });
    this.namespaceSlug = props.namespaceSlug;
    this.declaredSizeBytes = props.declaredSizeBytes;
    this.maxFileSizeBytes = props.maxFileSizeBytes;
  }
}
