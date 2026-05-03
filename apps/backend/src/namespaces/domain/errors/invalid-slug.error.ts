import { ValidationError } from "@/shared/kernel/domain/errors/validation-error.interface";

export class InvalidSlugError extends ValidationError {
  constructor(props: { input: unknown; reason: string }) {
    super({
      message: `Invalid namespace slug ${JSON.stringify(props.input)}: ${props.reason}`,
      params: props,
    });
  }
}
