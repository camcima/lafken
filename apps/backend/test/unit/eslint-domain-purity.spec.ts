import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

// Resolve the backend package root absolutely from the test file location.
// test/unit/eslint-domain-purity.spec.ts → ../.. → apps/backend
const BACKEND_DIR = path.resolve(__dirname, "../..");
// The fixture lives inside src so the domain glob picks it up.
const FIXTURE_DIR = path.join(BACKEND_DIR, "src/_purity_fixture/domain");
const FIXTURE_FILE = path.join(FIXTURE_DIR, "violation.ts");

afterAll(() => {
  rmSync(path.join(BACKEND_DIR, "src/_purity_fixture"), {
    recursive: true,
    force: true,
  });
});

const FORBIDDEN_SAMPLES = [
  { name: "new Date()", code: "export const x = new Date();" },
  { name: "Date.now()", code: "export const x = Date.now();" },
  { name: "Math.random()", code: "export const x = Math.random();" },
];

describe("ESLint domain-purity rule", () => {
  for (const sample of FORBIDDEN_SAMPLES) {
    // Each case spawns `pnpx eslint`, which resolves the binary and loads the
    // type-aware flat config (~16s in isolation). Under the loaded parallel
    // unit suite these spawns are CPU-starved and can reach ~60s, so give them
    // ample headroom to keep the pre-push hook deterministic on slower boxes.
    it(`rejects ${sample.name} inside src/**/domain/**`, { timeout: 120_000 }, () => {
      // Place the sample in a path the rule will scan.
      mkdirSync(FIXTURE_DIR, { recursive: true });
      writeFileSync(FIXTURE_FILE, sample.code);
      let output: string;
      let exitCode: number;
      try {
        // Run ESLint from the backend package root with an absolute path to the
        // fixture file so the flat config's files glob resolves correctly.
        output = execSync(`pnpx eslint ${FIXTURE_FILE}`, {
          cwd: BACKEND_DIR,
          encoding: "utf8",
        });
        exitCode = 0;
      } catch (err) {
        const e = err as { stdout?: string; stderr?: string; status?: number };
        output = `${e.stdout ?? ""}${e.stderr ?? ""}`;
        exitCode = e.status ?? 1;
      } finally {
        rmSync(path.join(BACKEND_DIR, "src/_purity_fixture"), {
          recursive: true,
          force: true,
        });
      }
      expect(exitCode!).toBeGreaterThan(0);
      expect(output!).toMatch(/no-restricted-syntax|domain-purity/u);
    });
  }
});
