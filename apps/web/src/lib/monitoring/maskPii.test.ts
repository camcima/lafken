import { describe, expect, it } from "vitest";

import { maskEmail } from "./maskPii";

describe("maskEmail", () => {
  it("masks a normal email to first-char + *** + @domain", () => {
    expect(maskEmail("thomas.rocha@latam.com")).toBe("t***@latam.com");
    expect(maskEmail("john@example.com")).toBe("j***@example.com");
    expect(maskEmail("a.b.c@sub.example.co")).toBe("a***@sub.example.co");
  });

  it("is case-preserving on the first character", () => {
    expect(maskEmail("Thomas@latam.com")).toBe("T***@latam.com");
  });

  it("handles single-character local parts", () => {
    expect(maskEmail("a@latam.com")).toBe("a***@latam.com");
  });

  it("returns undefined for malformed input (no @)", () => {
    expect(maskEmail("notanemail")).toBeUndefined();
    expect(maskEmail("")).toBeUndefined();
  });

  it("returns undefined for empty local part", () => {
    expect(maskEmail("@latam.com")).toBeUndefined();
  });

  it("returns undefined for empty domain", () => {
    expect(maskEmail("foo@")).toBeUndefined();
  });

  it("returns undefined for non-string input", () => {
    expect(maskEmail(undefined)).toBeUndefined();
    expect(maskEmail(null)).toBeUndefined();
    expect(maskEmail(123 as unknown as string)).toBeUndefined();
  });
});
