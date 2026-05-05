import { DomainError } from "@/shared/kernel/domain/errors/domain-error.interface";

export class UploadedObjectMissingError extends DomainError {
  public readonly publicId: string;
  public readonly storageKey: string;

  constructor(props: { publicId: string; storageKey: string }) {
    super({
      message: `Object for upload intent "${props.publicId}" not found at storage key "${props.storageKey}". The PUT to the signed URL likely never landed.`,
      params: props,
    });
    this.publicId = props.publicId;
    this.storageKey = props.storageKey;
  }
}
