import nestjsTyped from "@darraghor/eslint-plugin-nestjs-typed";
import eslint from "@eslint/js";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

const commonParserOptions = {
  projectService: {
    allowDefaultProject: ["eslint.config.mjs", "prettier.config.mjs", "../../apps/backend/scripts/*.mjs"],
  },
  tsconfigRootDir: import.meta.dirname,
};

export default defineConfig([
  {
    ignores: [
      "coverage/**",
      "node_modules",
      "out",
      "build",
      ".output/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...nestjsTyped.configs.flatRecommended,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.vitest,
      },
      ecmaVersion: 5,
      sourceType: "module",
      parserOptions: commonParserOptions,
    },
    ignores: ["eslint.config.mjs", ".prettierrc.mjs", "vault-secrets-config.mjs"],
  },
  {
    languageOptions: { parserOptions: commonParserOptions },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/prefer-as-const": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-unsafe-enum-comparison": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/require-await": "warn",
      "@typescript-eslint/no-floating-promises": [
        "error",
        {
          ignoreVoid: true,
        },
      ],
      "@typescript-eslint/interface-name-prefix": "off",
      "@typescript-eslint/consistent-type-exports": "error",
      "@typescript-eslint/no-unsafe-declaration-merging": "off",
      "@typescript-eslint/no-empty-object-type": "off",

      // Codebase wires providers via `provide`/`useClass`/`useExisting` object form,
      // which the rule's static analysis cannot detect reliably.
      "@darraghor/nestjs-typed/injectable-should-be-provided": "off",
      // We can use `ApiProperty` to rule them all instead of another decorator for optionality.
      "@darraghor/nestjs-typed/api-property-matches-property-optionality": "off",
      // Disabled due to false-positives when using the array notation
      "@darraghor/nestjs-typed/api-property-returning-array-should-set-array": "off",
      "@darraghor/nestjs-typed/validated-non-primitive-property-needs-type-decorator": [
        "error",
        { additionalTypeDecorators: ["IsIn"] },
      ],

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

      "no-process-env": "warn",
      "no-restricted-syntax": [
        "warn",
        {
          selector: "TSEnumDeclaration",
          message:
            "Avoid using TypeScript enums; consider string union types or literal types instead.",
        },
        // You can add other restricted syntaxes here if needed
      ],
      "require-await": "off",
      // Require template literals instead of string concatenation
      "prefer-template": "error",
      // Disallow unnecessary `return await` statements
      "no-return-await": "warn",
      // Warn console.log
      "no-console": "warn",
      // Correction for 'delete ␍' eslint error
      "prettier/prettier": [
        "error",
        {
          endOfLine: "auto",
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            // Disallow absolute imports starting from 'src/'
            "src/*",
          ],
        },
      ],
    },
  },
  {
    files: ["**/*.spec*", "test/e2e/**/*", "**/*.dto.ts"],
    rules: {
      "id-length": "off",
      "max-classes-per-file": "off",
      "no-magic-numbers": "off",
    },
  },
  {
    languageOptions: { parserOptions: commonParserOptions },
    files: ["test/**/*.spec.ts", "src/**/*.spec.ts"],
    rules: {
      "@typescript-eslint/unbound-method": "off",
    },
  },
]);
