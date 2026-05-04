import type { ZodIssue } from "zod";

import { ValidationError } from "@/shared/kernel/domain/errors/validation-error.interface";

export interface IStorageBindingConfigViolation {
  path: string;
  message: string;
  code: string;
}

export class InvalidStorageBindingConfigError extends ValidationError {
  constructor(issues: ZodIssue[]) {
    const violations: IStorageBindingConfigViolation[] = issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
      code: issue.code,
    }));
    super({
      message: "Storage binding config failed validation",
      params: { violations },
    });
  }
}
