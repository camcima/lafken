import { ValidationError } from "@/shared/kernel/domain/errors/validation-error.interface";

export class InvalidPresetParamsError extends ValidationError {
  constructor(props: { violations: Array<{ field: string; message: string }> }) {
    super({
      message: `Invalid preset params: ${props.violations.map((violation) => `${violation.field}: ${violation.message}`).join("; ")}`,
      params: props,
    });
  }
}
