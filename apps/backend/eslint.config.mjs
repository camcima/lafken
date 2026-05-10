import backendBaseEslintConfig from "@shared/style-config/nest-eslint.mjs";

export default [
  ...backendBaseEslintConfig,
  {
    files: ["src/**/domain/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "NewExpression[callee.name='Date']",
          message:
            "Domain code must be deterministic. Inject a Clock port instead of `new Date()`.",
        },
        {
          selector:
            "MemberExpression[object.name='Date'][property.name='now']",
          message:
            "Domain code must be deterministic. Inject a Clock port instead of `Date.now()`.",
        },
        {
          selector:
            "MemberExpression[object.name='Math'][property.name='random']",
          message:
            "Domain code must be deterministic. Inject a randomness port instead of `Math.random()`.",
        },
      ],
    },
  },
];
