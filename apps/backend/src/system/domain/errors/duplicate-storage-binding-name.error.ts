import { DomainError } from "@/shared/kernel/domain/errors/domain-error.interface";

export class DuplicateStorageBindingNameError extends DomainError {
  constructor(props: { name: string }) {
    super({
      message: `Storage binding "${props.name}" already exists.`,
      params: props,
    });
  }
}
