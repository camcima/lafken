import { z } from "zod";

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: z.core.$ZodIssue[],
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Validates data against a Zod schema and throws a custom ValidationError
 *
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @param errorMessage - Custom error message prefix
 * @returns Validated data
 *
 * @throws ValidationError if validation fails
 */
export function validateData<T>(schema: z.ZodType<T>, data: unknown, errorMessage: string): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(
        `${errorMessage}: ${error.issues.map((e) => e.message).join(", ")}`,
        error.issues,
        data,
      );
    }
    throw error;
  }
}

/**
 * Safely validates data against a Zod schema without throwing
 *
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 *
 * @returns Object with success flag and either data or error
 */
export function safeValidate<T>(
  schema: z.ZodType<T>,
  data: unknown,
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  return result.success
    ? { success: true, data: result.data }
    : { success: false, error: result.error };
}
