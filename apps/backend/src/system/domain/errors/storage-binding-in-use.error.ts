import { DomainError } from "@/shared/kernel/domain/errors/domain-error.interface";

export class StorageBindingInUseError extends DomainError {
  constructor(props: { name: string; namespaceCount: number }) {
    super({
      message: `Storage binding "${props.name}" cannot be deleted: ${props.namespaceCount} namespace(s) reference it.`,
      params: props,
    });
  }
}
