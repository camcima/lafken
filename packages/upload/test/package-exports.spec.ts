import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("@lafken/upload built package surface", () => {
  it("has dist artifacts at the documented paths", () => {
    const root = path.resolve(__dirname, "..");
    expect(existsSync(path.join(root, "dist/index.js"))).toBe(true);
    expect(existsSync(path.join(root, "dist/index.d.ts"))).toBe(true);
  });

  it("re-exports LafkenUploadManager from package root", async () => {
    const mod = await import("@lafken/upload");
    expect(mod.LafkenUploadManager).toBeDefined();
    expect(typeof mod.LafkenUploadManager).toBe("function");
  });
});
