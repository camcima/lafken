import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const IS_CI = process.env.CI === "true";
export default defineConfig({
  plugins: [react()],
  test: {
    passWithNoTests: true,
    silent: IS_CI ? "passed-only" : false,
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    exclude: ["node_modules", "dist", "build", "coverage"],
    coverage: {
      enabled: false,
      reportsDirectory: "./coverage",
      exclude: [
        "routeTree.gen.ts",
        "types.ts",
        "main.tsx",
        "*.stories.{ts,tsx}",
        "config/**/*.{ts,tsx}",
        "routes/**/*.{ts,tsx}",
        "types/**/*.{ts,tsx}",
        "mocks/**/*.{ts,tsx}",
        "lib/auth/config/**/*.{ts,tsx}",
        "lib/auth/interface/**/*.{ts,tsx}",
        "lib/auth/index.ts",
        "lib/monitoring/**/*.{ts,tsx}",
        "lib/i18n/**/*.{ts,tsx}",
        "lib/utils.ts",
      ],
      reporter: ["html", "text", ...(IS_CI ? ["cobertura", "lcov"] : [])],
      include: ["src/**/*.{ts,tsx}"],
      // thresholds: {
      //   statements: 80,
      //   branches: 80,
      //   functions: 80,
      //   lines: 80,
      // },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          dir: "src/",
          include: ["**/*.{test,spec}.{ts,tsx}"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          dir: "tests/integration",
          include: ["**/*.{test,spec}.{ts,tsx}"],
        },
      },
      {
        extends: true,
        test: {
          name: "scripts",
          dir: "test/scripts",
          include: ["**/*.{test,spec}.{ts,tsx}"],
          environment: "node",
        },
      },
    ],
  },
  resolve: {
    tsconfigPaths: true,
  },
});
