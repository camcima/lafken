export default {
  extends: [
    "@commitlint/config-conventional", // Follows the Conventional Commits spec.
  ],
  rules: {
    "body-max-line-length": [1, "always", 100],
    "subject-case": [1, "never", ["sentence-case", "start-case", "pascal-case", "upper-case"]],
  },
};
