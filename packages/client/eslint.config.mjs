import eslint from "@eslint/js";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import tsEslint from "typescript-eslint";

const commonParserOptions = {
  projectService: {
    allowDefaultProject: ["eslint.config.mjs", "vitest.config.ts", "test/*.ts"],
  },
  tsconfigRootDir: import.meta.dirname,
};

export default [
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**"],
  },
  eslint.configs.recommended,
  ...tsEslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ["src/**/*.ts", "test/**/*.ts"],
    languageOptions: {
      ...config.languageOptions,
      parserOptions: commonParserOptions,
    },
  })),
  {
    files: ["src/**/*.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@shared/backend-api",
              message:
                "@shared/backend-api is a types-only devDependency of @lafken/client. " +
                "Use `import type` — a runtime import would drag NestJS/class-validator " +
                "into browser bundles.",
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
  eslintPluginPrettierRecommended,
];
