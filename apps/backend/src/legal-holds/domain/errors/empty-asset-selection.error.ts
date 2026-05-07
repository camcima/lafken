import { DomainError } from "@/shared/kernel/domain/errors/domain-error.interface";

export class EmptyAssetSelectionError extends DomainError {
  constructor() {
    super({
      message: "Cannot place a legal hold without at least one asset",
    });
  }
}
