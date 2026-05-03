import { DomainError } from "@/shared/kernel/domain/errors/domain-error.interface";

export class NamespaceNotFoundError extends DomainError {
  constructor(props: { slug: string }) {
    super({
      message: `Namespace with slug "${props.slug}" was not found`,
      params: props,
    });
  }
}
