import { DomainError } from "@/shared/kernel/domain/errors/domain-error.interface";

export class NamespaceAlreadyExistsError extends DomainError {
  constructor(props: { slug: string }) {
    super({
      message: `A namespace with slug "${props.slug}" already exists.`,
      params: props,
    });
  }
}
