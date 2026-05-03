import backendBaseEslintConfig from "@shared/style-config/nest-eslint.mjs";
import { defineConfig } from "eslint/config";

const commonParserOptions = {
  projectService: {
    allowDefaultProject: ["eslint.config.mjs", "prettier.config.mjs"],
  },
  tsconfigRootDir: import.meta.dirname,
};

export default defineConfig([
  {
    ignores: ["node_modules/**", "dist/**"],
  },
  ...backendBaseEslintConfig,
  {
    languageOptions: {
      parserOptions: commonParserOptions,
    },
    files: ["eslint.config.mjs"],
    rules: {},
  },
]);
