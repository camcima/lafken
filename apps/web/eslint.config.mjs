import eslint from "@eslint/js";
import vitest from "@vitest/eslint-plugin";
import a11y from "eslint-plugin-jsx-a11y";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import storybook from "eslint-plugin-storybook";
import tsEslint from "typescript-eslint";

const commonParserOptions = {
  projectService: true,
  tsconfigRootDir: import.meta.dirname,
};

export default [
  {
    ignores: [
      "coverage/**",
      "node_modules",
      "out",
      "build",
      ".output/**",
      "dist/**",
      "public/config.js",
      "src/**/*.gen.ts",
      "scripts/**",
    ],
  },
  eslint.configs.recommended,
  ...tsEslint.configs.strictTypeChecked.map((config) => ({
    ...config,
    files: [
      "src/**/*.ts",
      "src/**/*.tsx",
      ".storybook/**/*.ts",
      ".storybook/**/*.tsx",
      "tests/**/*.ts",
      "tests/**/*.tsx",
      "*.config.ts",
      "vitest.setup.ts",
    ],
  })),
  eslintPluginPrettierRecommended,
  reactHooks.configs.flat.recommended,
  a11y.flatConfigs.recommended,
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    languageOptions: { parserOptions: commonParserOptions },
    rules: {
      "react/jsx-curly-brace-presence": "error",

      "@typescript-eslint/no-confusing-void-expression": "error",
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      "@typescript-eslint/unified-signatures": "off",
      // Disabled: these rules require strictNullChecks to be resolvable by eslint's
      // projectService, which fails in monorepo worktree setups despite strict:true in tsconfig.
      "@typescript-eslint/no-unnecessary-boolean-literal-compare": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/no-useless-default-assignment": "off",

      "no-console": "error",
      "max-classes-per-file": ["error", 1],
      "id-length": [
        "error",
        { min: 2, exceptions: ["id", "z", "e", "t", "q", "a", "b", "i", "_"] },
      ],
      eqeqeq: ["error", "always"],
      "no-magic-numbers": [
        "error",
        {
          detectObjects: false,
          enforceConst: true,
          ignore: [0, 1, -1, 2],
          ignoreArrayIndexes: true,
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../*", "../../*", "../../../*", "../../../../*"],
              message: "Please use @/ for imports outside the current directory.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["**/*.spec*", "**/*.dto.ts", "**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "max-classes-per-file": "off",
      "no-magic-numbers": "off",
    },
  },
  {
    files: [".storybook/**/*.ts", ".storybook/**/*.tsx"],
    languageOptions: { parserOptions: commonParserOptions },
  },
  {
    languageOptions: { parserOptions: commonParserOptions },
    plugins: { react },
    settings: { react: { version: "detect" } },
  },
  {
    files: ["src/**/*.{test,spec}.{ts,tsx}", "tests/integration/**/*.{test,spec}.{ts,tsx}"],
    plugins: { vitest },
    rules: {
      ...vitest.configs.recommended.rules,
      "vitest/no-disabled-tests": "warn",
      "vitest/no-conditional-expect": "warn",
    },
  },
  {
    files: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "tests/integration/**/*.{test,spec}.{ts,tsx}",
      "src/**/__test-utils__/**/*.{ts,tsx}",
      "src/**/__mocks__/**/*.{ts,tsx}",
      "vitest.setup.ts",
    ],
    rules: {
      "@typescript-eslint/consistent-type-assertions": "off",
    },
  },
  ...storybook.configs["flat/recommended"],
];
