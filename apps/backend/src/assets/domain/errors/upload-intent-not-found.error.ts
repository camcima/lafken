import { DomainError } from "@/shared/kernel/domain/errors/domain-error.interface";

export class UploadIntentNotFoundError extends DomainError {
  public readonly publicId: string;

  constructor(props: { publicId: string }) {
    super({
      message: `Upload intent with public ID "${props.publicId}" was not found.`,
      params: props,
    });
    this.publicId = props.publicId;
  }
}
