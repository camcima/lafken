import eslint from "@eslint/js";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import tsEslint from "typescript-eslint";

const commonParserOptions = {
  projectService: {
    allowDefaultProject: ["eslint.config.mjs", "vitest.config.ts", "test/*.ts", "test/*.tsx"],
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
    files: ["src/**/*.{ts,tsx}", "test/**/*.{ts,tsx}"],
    languageOptions: {
      ...config.languageOptions,
      parserOptions: commonParserOptions,
    },
  })),
  {
    files: ["src/**/*.{ts,tsx}", "test/**/*.{ts,tsx}"],
    plugins: {
      react,
      "react-hooks": reactHooks,
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
    },
    settings: {
      react: { version: "19.0" },
    },
  },
  eslintPluginPrettierRecommended,
];
