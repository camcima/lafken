import { describe, expect, it } from "vitest";

import { ValidationError } from "@/shared/kernel/domain/errors/validation-error.interface";
import { StorageBindingName } from "@/system/domain/value-objects/storage-binding-name.value-object";

describe("StorageBindingName", () => {
  it("accepts a valid kebab-case name", () => {
    const name = StorageBindingName.fromString("lafken-prod");
    expect(name.value).toBe("lafken-prod");
  });

  it("accepts a 3-char name (minimum valid)", () => {
    const name = StorageBindingName.fromString("abc");
    expect(name.value).toBe("abc");
  });

  it("accepts a 64-char name (maximum valid)", () => {
    const input = `a${"b".repeat(62)}c`;
    expect(input).toHaveLength(64);
    const name = StorageBindingName.fromString(input);
    expect(name.value).toBe(input);
  });

  it("rejects empty string", () => {
    expect(() => StorageBindingName.fromString("")).toThrow(ValidationError);
  });

  it("rejects uppercase characters", () => {
    expect(() => StorageBindingName.fromString("Lafken-Prod")).toThrow(ValidationError);
  });

  it("rejects names starting with a hyphen", () => {
    expect(() => StorageBindingName.fromString("-lafken")).toThrow(ValidationError);
  });

  it("rejects names ending with a hyphen", () => {
    expect(() => StorageBindingName.fromString("lafken-")).toThrow(ValidationError);
  });

  it("rejects names with underscores", () => {
    expect(() => StorageBindingName.fromString("lafken_prod")).toThrow(ValidationError);
  });

  it("rejects names with dots", () => {
    expect(() => StorageBindingName.fromString("lafken.prod")).toThrow(ValidationError);
  });

  it("rejects a 65-char name (over maximum)", () => {
    const input = `a${"b".repeat(63)}c`;
    expect(input).toHaveLength(65);
    expect(() => StorageBindingName.fromString(input)).toThrow(ValidationError);
  });
});
