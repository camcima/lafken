import { DomainError } from "@/shared/kernel/domain/errors/domain-error.interface";

export class NamespaceArchivedError extends DomainError {
  constructor(props: { slug: string }) {
    super({
      message: `Cannot edit policy on archived namespace "${props.slug}".`,
      params: props,
    });
  }
}
