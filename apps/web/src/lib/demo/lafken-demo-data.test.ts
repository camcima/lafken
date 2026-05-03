import { describe, expect, it } from "vitest";

import { DEMO_ASSET_LIST, DEMO_NAMESPACES, fmtAgo, fmtMinAgo } from "./lafken-demo-data";

describe("lafken-demo-data", () => {
  it("DEMO_NAMESPACES has entries", () => {
    expect(DEMO_NAMESPACES.length).toBeGreaterThan(0);
  });

  it("DEMO_ASSET_LIST has entries", () => {
    expect(DEMO_ASSET_LIST.length).toBeGreaterThan(0);
  });

  it('fmtAgo(5) returns "5m ago"', () => {
    expect(fmtAgo(5)).toBe("5m ago");
  });

  it('fmtAgo(90) returns "1h ago"', () => {
    expect(fmtAgo(90)).toBe("1h ago");
  });

  it('fmtAgo(1440) returns "1d ago"', () => {
    expect(fmtAgo(1440)).toBe("1d ago");
  });

  it('fmtMinAgo(0) returns "just now"', () => {
    expect(fmtMinAgo(0)).toBe("just now");
  });

  it('fmtMinAgo(5) returns "5m ago"', () => {
    expect(fmtMinAgo(5)).toBe("5m ago");
  });
});
