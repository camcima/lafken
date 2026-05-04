import { DomainError } from "@/shared/kernel/domain/errors/domain-error.interface";

export class PolicyVersionConflictError extends DomainError {
  constructor(props: { slug: string; attemptedVersion: number }) {
    super({
      message: `Concurrent edit on namespace "${props.slug}" — version ${props.attemptedVersion} was claimed by another writer.`,
      params: props,
    });
  }
}
