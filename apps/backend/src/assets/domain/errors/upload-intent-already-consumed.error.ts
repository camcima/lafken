import { DomainError } from "@/shared/kernel/domain/errors/domain-error.interface";

export class UploadIntentAlreadyConsumedError extends DomainError {
  public readonly publicId: string;
  public readonly consumedAt: Date;

  constructor(props: { publicId: string; consumedAt: Date }) {
    super({
      message: `Upload intent "${props.publicId}" was already consumed at ${props.consumedAt.toISOString()}.`,
      params: { publicId: props.publicId, consumedAt: props.consumedAt.toISOString() },
    });
    this.publicId = props.publicId;
    this.consumedAt = props.consumedAt;
  }
}
