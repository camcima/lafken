import { DomainError } from "@/shared/kernel/domain/errors/domain-error.interface";

export class TusNotConfiguredError extends DomainError {
  constructor() {
    super({
      message:
        'Cannot honor protocol "tus": TUSD_ENDPOINT_URL is not configured on this backend.',
    });
  }
}
