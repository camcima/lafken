import { describe, expect, it } from "vitest";

import { Slug } from "@/namespaces/domain/value-objects/slug.value-object";

describe("Slug", () => {
  it.each([
    "aircraft-photos",
    "tool-calibration",
    "a",
    "abc123",
    "long-multi-segment-slug-with-numbers-007",
  ])("accepts a valid slug %s", (input) => {
    expect(() => new Slug(input)).not.toThrow();
    expect(new Slug(input).value).toBe(input);
  });

  it.each([
    "",
    "  ",
    "Aircraft-Photos", // uppercase
    "aircraft_photos", // underscore
    "aircraft photos", // whitespace
    "-leading", // leading dash
    "trailing-", // trailing dash
    "double--dash", // consecutive dashes
    "a".repeat(65), // too long
  ])("rejects invalid slug %s", (input) => {
    expect(() => new Slug(input)).toThrow();
  });

  it("treats two slugs with the same value as equal", () => {
    expect(new Slug("foo").equals(new Slug("foo"))).toBe(true);
    expect(new Slug("foo").equals(new Slug("bar"))).toBe(false);
  });
});
