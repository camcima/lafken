import { DomainError } from "@/shared/kernel/domain/errors/domain-error.interface";

export class AssetsNotFoundForLegalHoldError extends DomainError {
  constructor(props: { missingPublicIds: string[] }) {
    super({
      message: `Some asset public ids do not exist: ${props.missingPublicIds.join(", ")}`,
      params: { missingPublicIds: props.missingPublicIds },
    });
  }
}
