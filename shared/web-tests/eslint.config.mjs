import eslint from "@eslint/js";
import vitest from "@vitest/eslint-plugin";
import playwright from "eslint-plugin-playwright";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import tsEslint from "typescript-eslint";

export default [
  eslint.configs.recommended,
  eslintPluginPrettierRecommended,
  ...tsEslint.configs.strictTypeChecked.map((config) => ({
    ...config,
    files: ["**/*.ts", "**/*.tsx"],
  })),
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    ...playwright.configs["flat/recommended"],
    files: [
      "**/e2e/**/*.spec.ts",
      "**/e2e/**/*.spec.tsx",
      "**/e2e/**/*.test.ts",
      "**/e2e/**/*.test.tsx",
    ],
  },
  {
    files: [
      "**/integration/**/*.spec.ts",
      "**/integration/**/*.spec.tsx",
      "**/integration/**/*.test.ts",
      "**/integration/**/*.test.tsx",
    ],
    plugins: { vitest },
    rules: {
      ...vitest.configs.recommended.rules,
      "vitest/no-disabled-tests": "warn",
    },
  },
];
