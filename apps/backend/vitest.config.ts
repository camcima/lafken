import dotenv from "dotenv";
import swc from "unplugin-swc";
import { coverageConfigDefaults, defineConfig } from "vitest/config";

dotenv.config({
  path: [".env.test"],
  override: false,
  quiet: true,
});

// eslint-disable-next-line no-process-env
const IS_CI = process.env.CI === "true";

export default defineConfig({
  plugins: [
    // using swc to proper support TypeScript decorators metadata
    swc.vite({
      module: { type: "es6" },
    }),
  ],
  // The `swc.vite()` plugin sets `esbuild: false` to disable Vite's default
  // TypeScript transform. Vitest 4 moved that default to Oxc, so we must
  // also disable Oxc explicitly to avoid both running and to silence the
  // "esbuild: false has no effect" warning.
  oxc: false,
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    dir: "test",
    environment: "node",
    logHeapUsage: true,
    passWithNoTests: true,
    reporters: [["default", { summary: false, outputFile: false }]],
    typecheck: {
      ignoreSourceErrors: true,
    },
    silent: IS_CI ? "passed-only" : false,
    globals: true,

    coverage: {
      enabled: IS_CI, // Auto-enable coverage in CI for SonarQube analysis
      clean: true,
      provider: "v8",
      thresholds: undefined, // We can't have thresholds because the coverage are generating independently for each project
      reporter: ["html", "text", ...(IS_CI ? ["cobertura", "lcov"] : [])],
      reportsDirectory: "./coverage",
      exclude: [...coverageConfigDefaults.exclude, "__mocks__/**"],
    },

    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          sequence: {
            groupOrder: 1,
          },

          dir: "test/unit",
          include: ["**/*.spec.ts"],
          setupFiles: ["./test/unit/setup.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          sequence: {
            groupOrder: 2,
          },

          dir: "test/integration",
          include: ["**/*.spec.ts"],

          setupFiles: ["./test/integration/setup.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "E2E",

          dir: "test/e2e",
          include: ["**/*.e2e-spec.ts"],

          globalSetup: "./test/e2e/global-e2e-setup.ts",

          logHeapUsage: false,

          // We are expecting to run all E2E tests in the same process using the same database instance
          // and so we need to disable the isolation and concurrency features otherwise one suite
          // might fail because of the other suites are still running and touching the same data.
          isolate: false,
          bail: 1,
          fileParallelism: false,
          testTimeout: 60_000,
          maxConcurrency: 10,
          sequence: {
            groupOrder: 3,
            shuffle: false,
            concurrent: false, // force sequential execution of tests in the same test suite file
            hooks: "list", // force sequential execution of hooks
          },
        },
      },
    ],
  },
});
