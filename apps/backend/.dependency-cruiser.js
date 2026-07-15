/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // This rule ensures the domain layer of a feature (e.g., 'orders')
    // does not depend on the application, infrastructure, or presentation
    // layers of the *same* feature.
    // It uses a capture group `([^/]+)` for the feature name and dependency-cruiser's
    // `$1` placeholder to constrain the rule to a single feature slice. `$1` is
    // substituted into `to.path` before it is compiled; a regex backreference (`\1`)
    // would silently never match, which is exactly how this rule sat dead.
    {
      name: "feature-domain-cannot-depend-on-other-layers-in-same-feature",
      severity: "error",
      from: { path: "^src/([^/]+)/domain" },
      to: { path: "^src/$1/(application|infrastructure|presentation)" },
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

    // CLAUDE.md's first, most important hexagonal rule: "Domain has no
    // external dependencies... must not import from infrastructure,
    // frameworks, ORMs, HTTP clients, or third-party libraries." Nothing
    // above enforced this — `no-application-into-shared-infrastructure` only
    // covers `/application/`, and no rule at all blocked domain from
    // reaching into shared/infrastructure. Domain needs a port; the adapter
    // is bound at the composition root like every other outward dependency.
    {
      name: "no-domain-into-shared-infrastructure",
      severity: "error",
      comment:
        "Domain must not depend on shared infrastructure. Define a domain-owned port and bind the adapter at the composition root.",
      from: { path: "^src/[^/]+/domain" },
      to: { path: "^src/shared/infrastructure/" },
    },

    // Companion to the rule above: domain must also stay framework-free —
    // no npm dependency at all (NestJS decorators, ORMs, HTTP clients,
    // validation libraries, anything). If domain needs something external,
    // it defines a port it owns and an outer layer implements it.
    //
    // Lists all seven `npm*` dependencyTypes dependency-cruiser recognizes,
    // not just the four ("npm", "npm-dev", "npm-peer", "npm-optional") that
    // cover a package declared in *this* workspace's own package.json. In
    // this pnpm monorepo, a domain file importing `zod` (declared only in
    // the repo-root package.json, not apps/backend/package.json) resolves
    // as dependencyType "npm-no-pkg" — proven empirically while wiring this
    // rule up: the four-type list let that exact violation through
    // silently. Also including "npm-bundled" and "npm-unknown" so no
    // resolution-mechanism quirk creates another blind spot.
    {
      name: "domain-is-framework-free",
      severity: "error",
      comment:
        "Domain code must not depend on any third-party package. Define a port and let an outer layer implement it.",
      from: { path: "^src/[^/]+/domain" },
      to: {
        dependencyTypes: [
          "npm",
          "npm-dev",
          "npm-peer",
          "npm-optional",
          "npm-bundled",
          "npm-no-pkg",
          "npm-unknown",
        ],
      },
    },

    // Presentation (controllers, guards, response mappers, decorators) reaches
    // infrastructure only through application ports — for ANY feature, not
    // just its own. Two sanctioned escapes (verified by grep against the
    // current src tree, see F-A3 part 3 report):
    //   * the parsed environment configuration object (the config-module rule
    //     explicitly blesses reading it anywhere in the composition graph) —
    //     imported by shared/presentation/auth/oidc/oidc-bearer-authn.strategy.ts
    //     and shared/presentation/documentation/open-api-loader.ts;
    //   * DatabaseClient in the Terminus health indicator (a health probe
    //     pinging the DB directly is its whole job) —
    //     health/presentation/indicators/database-health.indicator.ts.
    {
      name: "no-presentation-into-infrastructure",
      severity: "error",
      comment:
        "Presentation must not import adapters or raw infrastructure (see F-A3). Route through an application port.",
      from: { path: "^src/[^/]+/presentation" },
      to: {
        path: "^src/[^/]+/infrastructure",
        // Anchored with `\.ts$` so these `pathNot` escapes only ever match
        // the two exact files they were written for — an unanchored prefix
        // match (e.g. `database-client`) would also silently exempt a
        // future `database-client-pool.ts` or similar.
        pathNot: [
          "^src/shared/infrastructure/environment\\.configuration\\.ts$",
          "^src/shared/infrastructure/persistence/database-client\\.ts$",
        ],
      },
    },

    // `no-presentation-into-infrastructure`'s `database-client` escape above
    // is scoped to `^src/[^/]+/infrastructure` in general, which makes it a
    // *global* exemption: any presentation file anywhere gets a free pass to
    // import DatabaseClient directly, not just the one Terminus health
    // indicator the comment names. This companion rule closes that hole by
    // forbidding presentation -> database-client specifically, with the one
    // sanctioned caller (the health probe, whose whole job is pinging the DB
    // directly) as the only `from.pathNot` exception.
    {
      name: "no-presentation-into-database-client",
      severity: "error",
      comment:
        "Only the Terminus DB health indicator may import DatabaseClient directly from presentation. Every other presentation file must route through an application port.",
      from: {
        path: "^src/[^/]+/presentation",
        pathNot: ["^src/health/presentation/indicators/database-health\\.indicator\\.ts$"],
      },
      to: { path: "^src/shared/infrastructure/persistence/database-client" },
    },

    // A feature's domain must not import another feature's internals.
    // Sanctioned exception (from.pathNot): the assets processing repository
    // port consumes the namespaces policy entity — the one blessed
    // assets<->namespaces pipeline contract (see F-A3 / IMPLEMENTATION_REVIEW).
    {
      name: "no-domain-cross-feature-imports",
      severity: "error",
      comment:
        "Domain layers own no cross-feature dependencies. If two contexts must share a type, bless it explicitly here or move it to shared/kernel.",
      from: {
        path: "^src/([^/]+)/domain",
        pathNot: ["^src/assets/domain/repositories/asset-processing\\.repository\\.port\\.ts$"],
      },
      to: {
        path: "^src/((?!$1)[^/]+)/(domain|application|infrastructure|presentation)",
        pathNot: ["^src/shared/"],
      },
    },

    // Application-layer cross-feature imports stay visible as warnings for
    // now: the codebase legitimately composes cross-context ports in use
    // cases (audit, storage bindings, namespaces). Tightening this to error
    // is future work (F-A10 remainder) — see the triage in the F-A3 part 3
    // report before doing so; 45 warnings exist today and must be resolved
    // or explicitly sanctioned first.
    // Scoped to `application` only (not `domain`): cross-feature domain
    // imports are already covered, at error severity, by
    // `no-domain-cross-feature-imports` above. Keeping `domain` here too
    // would just double-report the same edges as both an error and a warning.
    {
      name: "no-cross-feature-implementation-imports",
      severity: "warn",
      from: { path: "^src/([^/]+)/application" },
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
    // Without this, dependency-cruiser silently drops `import type { ... }`
    // edges from the graph (they don't exist post-compilation), which is a
    // blind spot for every rule above: this codebase's own style guide
    // recommends `import type` for type-only imports, so a boundary
    // violation written as `import type` would be invisible otherwise. See
    // F-A3 part 3 report for the empirical proof (a planted `import type`
    // domain-to-domain cross-feature import was NOT flagged until this was
    // enabled).
    tsPreCompilationDeps: true,
  },
};
