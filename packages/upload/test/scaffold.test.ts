import { describe, expect, it } from "vitest";

import { __SLICE3_SCAFFOLD } from "../src/index";

describe("@lafken/upload scaffold", () => {
  it("exposes scaffold marker", () => {
    expect(__SLICE3_SCAFFOLD).toBe(true);
  });
});
