import { DomainError } from "@/shared/kernel/domain/errors/domain-error.interface";

export class LegalHoldAlreadyLiftedError extends DomainError {
  constructor(props: { id: string }) {
    super({
      message: `Legal hold with id "${props.id}" is already lifted`,
      params: props,
    });
  }
}
