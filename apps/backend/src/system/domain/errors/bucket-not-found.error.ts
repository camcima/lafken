import { DomainError } from "@/shared/kernel/domain/errors/domain-error.interface";

export class BucketNotFoundError extends DomainError {
  constructor(props: { adapterType: string; bucket: string }) {
    super({
      message: `Bucket "${props.bucket}" was not found in the ${props.adapterType} backend.`,
      params: props,
    });
  }
}
