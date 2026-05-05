import { DomainError } from "@/shared/kernel/domain/errors/domain-error.interface";

export class StorageBindingMissingError extends DomainError {
  constructor(props: { storageBindingId: string }) {
    super({
      message: `Storage binding ${props.storageBindingId.toString()} does not exist.`,
      params: { storageBindingId: props.storageBindingId.toString() },
    });
  }
}
