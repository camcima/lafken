import { ValidationError } from "@/shared/kernel/domain/errors/validation-error.interface";

export class InvalidStorageBindingNameError extends ValidationError {
  constructor(value: string) {
    super({
      message: `Invalid storage binding name "${value}". Use 3..64 lowercase chars, digits, or hyphens; must start and end alphanumeric.`,
      params: { value },
    });
  }
}
