import { DomainError } from "@/shared/kernel/domain/errors/domain-error.interface";

export class LegalHoldNotFoundError extends DomainError {
  constructor(props: { id: string }) {
    super({
      message: `Legal hold with id "${props.id}" was not found`,
      params: props,
    });
  }
}
