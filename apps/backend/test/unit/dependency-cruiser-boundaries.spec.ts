import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// Resolve the backend package root absolutely from the test file location.
// test/unit/dependency-cruiser-boundaries.spec.ts → ../.. → apps/backend
const BACKEND_DIR = path.resolve(__dirname, "../..");

// Two disposable "features" so the cross-feature scenario has a genuine
// second feature slug to compare against. Both live under src/ so the
// dependency-cruiser `from`/`to` globs (which are anchored on `^src/...`)
// pick them up exactly like a real feature module would.
const FIXTURE_FEATURE_DIR = path.join(BACKEND_DIR, "src/_depcruise_fixture_a");
const FIXTURE_OTHER_FEATURE_DIR = path.join(BACKEND_DIR, "src/_depcruise_fixture_b");

function cleanFixtures(): void {
  rmSync(FIXTURE_FEATURE_DIR, { recursive: true, force: true });
  rmSync(FIXTURE_OTHER_FEATURE_DIR, { recursive: true, force: true });
}

function writeFixtureFile(absolutePath: string, contents: string): void {
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, contents);
}

interface IDepCruiseResult {
  output: string;
  exitCode: number;
}

function runDepCruise(): IDepCruiseResult {
  try {
    // Run the actual `dep-check` package script (not `pnpx depcruise` /
    // `npx depcruise` directly): "depcruise" as a standalone registry
    // package is an unrelated dependency-confusion placeholder, not the
    // `dependency-cruiser` CLI. `pnpm dep-check` resolves the real local
    // binary the same way CI does, so this test exercises the actual gate.
    const output = execSync("pnpm dep-check", {
      cwd: BACKEND_DIR,
      encoding: "utf8",
    });
    return { output, exitCode: 0 };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return { output: `${e.stdout ?? ""}${e.stderr ?? ""}`, exitCode: e.status ?? 1 };
  }
}

/**
 * Each scenario plants a fixture file that reproduces the exact shape of a
 * real boundary violation for one `error`-severity rule in
 * `.dependency-cruiser.js`, then asserts `dep-check` fails and names that
 * rule. This is the guard for the guard: the three feature-scoped rules
 * silently never fired for months because they referenced the feature-name
 * capture group as `\1` (a regex backreference) instead of dependency-
 * cruiser's `$1` placeholder — `pnpm dep-check` kept reporting
 * "no dependency violations found" the whole time. A fixture that plants a
 * real violation and asserts the tool actually screams is the only way to
 * know a rule still matches; a rule nobody watches fail is not a rule.
 */
const SCENARIOS: Array<{ name: string; ruleName: string; plant: () => void }> = [
  {
    name: "a feature's domain importing its own application layer",
    ruleName: "feature-domain-cannot-depend-on-other-layers-in-same-feature",
    plant: () => {
      writeFixtureFile(
        path.join(FIXTURE_FEATURE_DIR, "application/target.ts"),
        "export const fixtureTarget = 'target';\n",
      );
      writeFixtureFile(
        path.join(FIXTURE_FEATURE_DIR, "domain/violation.ts"),
        'import { fixtureTarget } from "@/_depcruise_fixture_a/application/target";\n' +
          "export const violation = fixtureTarget;\n",
      );
    },
  },
  {
    name: "a feature's domain importing its own presentation layer",
    ruleName: "feature-domain-cannot-depend-on-other-layers-in-same-feature",
    plant: () => {
      writeFixtureFile(
        path.join(FIXTURE_FEATURE_DIR, "presentation/target.ts"),
        "export const fixtureTarget = 'target';\n",
      );
      writeFixtureFile(
        path.join(FIXTURE_FEATURE_DIR, "domain/violation.ts"),
        'import { fixtureTarget } from "@/_depcruise_fixture_a/presentation/target";\n' +
          "export const violation = fixtureTarget;\n",
      );
    },
  },
  {
    name: "a feature's application layer importing its own infrastructure layer",
    ruleName: "feature-application-cannot-depend-on-infrastructure-in-same-feature",
    plant: () => {
      writeFixtureFile(
        path.join(FIXTURE_FEATURE_DIR, "infrastructure/target.ts"),
        "export const fixtureTarget = 'target';\n",
      );
      writeFixtureFile(
        path.join(FIXTURE_FEATURE_DIR, "application/violation.ts"),
        'import { fixtureTarget } from "@/_depcruise_fixture_a/infrastructure/target";\n' +
          "export const violation = fixtureTarget;\n",
      );
    },
  },
  {
    name: "any application layer importing shared infrastructure directly",
    ruleName: "no-application-into-shared-infrastructure",
    plant: () => {
      writeFixtureFile(
        path.join(FIXTURE_FEATURE_DIR, "application/violation.ts"),
        'import { environmentConfiguration } from "@/shared/infrastructure/environment.configuration";\n' +
          "export const violation = environmentConfiguration;\n",
      );
    },
  },
  {
    name: "any feature's presentation layer importing infrastructure (not one of the two sanctioned escapes)",
    ruleName: "no-presentation-into-infrastructure",
    plant: () => {
      writeFixtureFile(
        path.join(FIXTURE_FEATURE_DIR, "infrastructure/target.ts"),
        "export const fixtureTarget = 'target';\n",
      );
      writeFixtureFile(
        path.join(FIXTURE_FEATURE_DIR, "presentation/violation.ts"),
        'import { fixtureTarget } from "@/_depcruise_fixture_a/infrastructure/target";\n' +
          "export const violation = fixtureTarget;\n",
      );
    },
  },
  {
    name: "one feature's domain importing another feature's domain (regular import)",
    ruleName: "no-domain-cross-feature-imports",
    plant: () => {
      writeFixtureFile(
        path.join(FIXTURE_OTHER_FEATURE_DIR, "domain/target.ts"),
        "export const fixtureTarget = 'target';\n",
      );
      writeFixtureFile(
        path.join(FIXTURE_FEATURE_DIR, "domain/violation.ts"),
        'import { fixtureTarget } from "@/_depcruise_fixture_b/domain/target";\n' +
          "export const violation = fixtureTarget;\n",
      );
    },
  },
  {
    name: "one feature's domain importing another feature's domain via a type-only import",
    ruleName: "no-domain-cross-feature-imports",
    plant: () => {
      // This is the scenario that motivated `tsPreCompilationDeps: true` in
      // options: without it, `import type` edges don't exist post-compilation
      // and dependency-cruiser drops them from the graph entirely, so this
      // exact violation shape would pass silently. This project's own style
      // guide recommends `import type` for type-only imports, so this is not
      // a hypothetical — it is the realistic shape a real violation takes.
      writeFixtureFile(
        path.join(FIXTURE_OTHER_FEATURE_DIR, "domain/target.ts"),
        "export interface IFixtureTarget { value: string }\n",
      );
      writeFixtureFile(
        path.join(FIXTURE_FEATURE_DIR, "domain/violation.ts"),
        'import type { IFixtureTarget } from "@/_depcruise_fixture_b/domain/target";\n' +
          "export const violation: IFixtureTarget = { value: 'x' };\n",
      );
    },
  },
];

describe("dependency-cruiser architectural boundaries (fixture-based, self-defending)", () => {
  for (const scenario of SCENARIOS) {
    // Each case spawns `pnpm dep-check` against the whole `src` tree, which
    // takes a few seconds; give it ample headroom so it stays deterministic
    // on a loaded or slower box.
    it(`fails dep-check for ${scenario.name} [${scenario.ruleName}]`, { timeout: 60_000 }, () => {
      cleanFixtures();
      scenario.plant();
      let result: IDepCruiseResult;
      try {
        result = runDepCruise();
      } finally {
        cleanFixtures();
      }
      expect(result.exitCode).toBeGreaterThan(0);
      expect(result.output).toMatch(new RegExp(`error ${scenario.ruleName}`, "u"));
    });
  }
});
