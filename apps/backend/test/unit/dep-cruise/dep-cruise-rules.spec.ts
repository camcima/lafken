import { execSync } from "node:child_process";

import { describe, expect, it } from "vitest";

describe("dependency-cruiser global rules", () => {
  it("forbids application/** from importing shared/infrastructure/**", () => {
    let output: string;
    let exitCode = 0;
    try {
      output = execSync(
        "npx depcruise --config .dependency-cruiser.js test/dep-cruise/positive/fake-feature/application/violation.ts",
        { cwd: process.cwd(), encoding: "utf8" },
      );
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; status?: number };
      output = `${e.stdout ?? ""}${e.stderr ?? ""}`;
      exitCode = e.status ?? 1;
    }
    expect(exitCode).toBeGreaterThan(0);
    expect(output).toMatch(/no-application-into-shared-infrastructure/u);
  });
});
