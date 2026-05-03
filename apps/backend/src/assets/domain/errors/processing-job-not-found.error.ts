import { DomainError } from "@/shared/kernel/domain/errors/domain-error.interface";

export class ProcessingJobNotFoundError extends DomainError {
  constructor(props: { publicId: string }) {
    super({
      message: `Processing job for asset with public ID "${props.publicId}" was not found`,
      params: props,
    });
  }
}
