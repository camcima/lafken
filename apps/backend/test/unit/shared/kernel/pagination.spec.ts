import { describe, expect, it } from "vitest";

import { computeLastPage } from "@/shared/kernel/domain/pagination";

describe("computeLastPage", () => {
  it("rounds partial pages up", () => {
    expect(computeLastPage(21, 20)).toBe(2);
  });

  it("returns 1 for an empty result set", () => {
    expect(computeLastPage(0, 20)).toBe(1);
  });

  it("returns exact page counts on full pages", () => {
    expect(computeLastPage(40, 20)).toBe(2);
  });

  it("never returns Infinity when limit is 0", () => {
    expect(computeLastPage(50, 0)).toBe(50);
  });

  it("guards negative limits", () => {
    expect(computeLastPage(50, -5)).toBe(50);
  });
});
