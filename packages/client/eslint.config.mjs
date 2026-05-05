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
  eslintPluginPrettierRecommended,
];
