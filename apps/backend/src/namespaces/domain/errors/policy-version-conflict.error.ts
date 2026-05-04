import { DomainError } from "@/shared/kernel/domain/errors/domain-error.interface";

export class PolicyVersionConflictError extends DomainError {
  public readonly slug: string;
  public readonly attemptedVersion: number;

  constructor(props: { slug: string; attemptedVersion: number }) {
    super({
      message: `Concurrent edit on namespace "${props.slug}" — version ${props.attemptedVersion} was claimed by another writer.`,
      params: props,
    });
    this.slug = props.slug;
    this.attemptedVersion = props.attemptedVersion;
  }
}
