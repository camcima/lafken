import { DomainError } from "@/shared/kernel/domain/errors/domain-error.interface";

export class AssetNotFoundError extends DomainError {
  constructor(props: { publicId: string }) {
    super({
      message: `Asset with public ID "${props.publicId}" was not found`,
      params: props,
    });
  }
}
