/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // This rule ensures the domain layer of a feature (e.g., 'orders')
    // does not depend on the application or infrastructure layers of the *same* feature.
    // It uses a capture group `([^/]+)` for the feature name and a backreference `\\1`
    // to ensure the rule is constrained to a single feature slice.
    {
      name: "feature-domain-cannot-depend-on-other-layers-in-same-feature",
      severity: "error",
      from: { path: "^src/([^/]+)/domain" },
      to: { path: "^src/$1/(application|infrastructure)" },
    },

    // This rule ensures the application layer of a feature
    // does not depend on the infrastructure layer of the *same* feature.
    {
      name: "feature-application-cannot-depend-on-infrastructure-in-same-feature",
      severity: "error",
      from: { path: "^src/([^/]+)/application" },
      to: { path: "^src/$1/infrastructure" },
    },

    // This rule forbids any application-layer file (path contains /application/)
    // from importing directly from shared/infrastructure. Application code must
    // define a port and have the adapter injected at the composition root.
    {
      name: "no-application-into-shared-infrastructure",
      severity: "error",
      comment:
        "Application code must not depend on shared infrastructure. Define an application-layer port and bind the adapter at the composition root.",
      from: { path: "/application/" },
      to: { path: "^src/shared/infrastructure/" },
    },

    // OPTIONAL BUT RECOMMENDED:
    // This rule prevents one feature's implementation (e.g., `orders/domain`)
    // from depending on the implementation of another feature (e.g., `users/domain`).
    // Features should communicate through their public API (e.g., the feature module).
    {
      name: "no-cross-feature-implementation-imports",
      severity: "warn", // Start with 'warn' to avoid breaking builds immediately
      from: { path: "^src/([^/]+)/(domain|application)" },
      to: {
        path: "^src/((?!$1)[^/]+)/(domain|application)",
        // `shared/` is the deliberate cross-cutting module (ports, logger,
        // persistence primitives); it is not another feature's implementation.
        pathNot: ["^src/shared/"],
      },
    },
  ],
  options: {
    // ... other options
    doNotFollow: {
      path: "node_modules",
    },
    tsConfig: {
      fileName: "tsconfig.json",
    },
  },
};
