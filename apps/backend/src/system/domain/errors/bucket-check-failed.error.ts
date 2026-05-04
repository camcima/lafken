import { DomainError } from "@/shared/kernel/domain/errors/domain-error.interface";

export class BucketCheckFailedError extends DomainError {
  constructor(props: { adapterType: string; bucket: string; cause: string }) {
    super({
      message: `Failed to verify bucket "${props.bucket}" in the ${props.adapterType} backend: ${props.cause}`,
      params: props,
    });
  }
}
