import { DomainError } from "@/shared/kernel/domain/errors/domain-error.interface";

export class StorageBindingNotFoundError extends DomainError {
  constructor(props: { name: string }) {
    super({
      message: `Storage binding with name "${props.name}" was not found`,
      params: props,
    });
  }
}
