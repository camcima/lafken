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
  {
    // validation-constants.ts is value-imported straight into the apps/web
    // browser bundle via the `@shared/backend-api/validation` subpath. It
    // MUST stay free of imports — any dependency here (NestJS decorators,
    // class-validator, etc.) would ship into the browser. This rule makes
    // that invariant a build failure instead of a doc comment nobody reads.
    files: ["shared/validation-constants.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**"],
              message:
                "validation-constants.ts is value-imported by apps/web through the " +
                "@shared/backend-api/validation subpath. It MUST stay free of imports — " +
                "any dependency here (e.g. @nestjs/*, class-validator) would ship " +
                "NestJS/class-validator into the browser bundle.",
            },
          ],
        },
      ],
    },
  },
]);
