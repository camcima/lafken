import { ValidationError } from "@/shared/kernel/domain/errors/validation-error.interface";

export class InvalidStorageBindingNameError extends ValidationError {
  constructor(props: { value: string }) {
    super({
      message: `Invalid storage binding name "${props.value}". Use 3..64 lowercase chars, digits, or hyphens; must start and end alphanumeric.`,
      params: props,
    });
  }
}
