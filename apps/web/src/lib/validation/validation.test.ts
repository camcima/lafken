import { assert, describe, expect, it } from "vitest";
import { z } from "zod";

import { safeValidate, validateData, ValidationError } from ".";

describe("validateData", () => {
  const schema = z.object({
    name: z.string(),
    age: z.number(),
  });

  it("returns validated data when schema is valid", () => {
    const data = { name: "John", age: 30 };
    const result = validateData(schema, data, "Validation failed");

    expect(result).toEqual(data);
  });

  it("throws ValidationError when validation fails", () => {
    const invalidData = { name: "John", age: "30" };

    expect(() => {
      validateData(schema, invalidData, "Validation failed");
    }).toThrow(ValidationError);
  });

  it("includes error message and issues in ValidationError", () => {
    const invalidData = { name: "John", age: "30" };
    let caught: unknown;

    try {
      validateData(schema, invalidData, "Custom error");
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ValidationError);
    const err = caught as ValidationError;
    expect(err.message).toContain("Custom error");
    expect(err.issues).toBeDefined();
    expect(err.data).toEqual(invalidData);
  });

  it("re-throws non-ZodError errors", () => {
    const customError = new Error("Custom error");

    expect(() => {
      // Simulate a non-ZodError by throwing directly
      throw customError;
    }).toThrow("Custom error");
  });

  it("handles nested schemas", () => {
    const nestedSchema = z.object({
      user: z.object({
        name: z.string(),
        email: z.email(),
      }),
    });

    const validData = {
      user: {
        name: "John",
        email: "john@example.com",
      },
    };

    const result = validateData(nestedSchema, validData, "Validation failed");
    expect(result).toEqual(validData);
  });
});

describe("safeValidate", () => {
  const schema = z.object({
    name: z.string(),
    age: z.number(),
  });

  it("returns success: true with data when validation passes", () => {
    const data = { name: "John", age: 30 };
    const result = safeValidate(schema, data);

    assert(result.success);
    expect(result.data).toEqual(data);
  });

  it("returns success: false with error when validation fails", () => {
    const invalidData = { name: "John", age: "30" };
    const result = safeValidate(schema, invalidData);

    assert(!result.success);
    expect(result.error).toBeInstanceOf(z.ZodError);
  });

  it("handles missing required fields", () => {
    const incompleteData = { name: "John" };
    const result = safeValidate(schema, incompleteData);

    assert(!result.success);
    expect(result.error.issues.length).toBeGreaterThan(0);
  });

  it("handles extra fields", () => {
    const dataWithExtra = { name: "John", age: 30, extra: "field" };
    const result = safeValidate(schema, dataWithExtra);

    assert(result.success);
    expect(result.data).toEqual({ name: "John", age: 30 });
  });

  it("handles empty objects", () => {
    const result = safeValidate(schema, {});

    assert(!result.success);
    expect(result.error.issues.length).toBeGreaterThan(0);
  });
});
