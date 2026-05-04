import { ValidationError } from "@/shared/kernel/domain/errors/validation-error.interface";

export interface IStorageBindingConfigViolation {
  path: string;
  message: string;
  code: string;
}

export class InvalidStorageBindingConfigError extends ValidationError {
  constructor(props: { violations: IStorageBindingConfigViolation[] }) {
    super({
      message: "Storage binding config failed validation",
      params: props,
    });
  }
}
