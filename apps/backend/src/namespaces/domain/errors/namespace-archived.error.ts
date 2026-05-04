import { DomainError } from "@/shared/kernel/domain/errors/domain-error.interface";

export class NamespaceArchivedError extends DomainError {
  public readonly slug: string;

  constructor(props: { slug: string }) {
    super({
      message: `Cannot edit policy on archived namespace "${props.slug}".`,
      params: props,
    });
    this.slug = props.slug;
  }
}
