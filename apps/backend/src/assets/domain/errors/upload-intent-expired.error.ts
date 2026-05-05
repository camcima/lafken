import { DomainError } from "@/shared/kernel/domain/errors/domain-error.interface";

export class UploadIntentExpiredError extends DomainError {
  public readonly publicId: string;
  public readonly expiredAt: Date;

  constructor(props: { publicId: string; expiredAt: Date }) {
    super({
      message: `Upload intent "${props.publicId}" expired at ${props.expiredAt.toISOString()}.`,
      params: { publicId: props.publicId, expiredAt: props.expiredAt.toISOString() },
    });
    this.publicId = props.publicId;
    this.expiredAt = props.expiredAt;
  }
}
