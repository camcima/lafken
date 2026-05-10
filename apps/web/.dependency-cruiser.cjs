/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-demo-imports",
      severity: "error",
      comment:
        "Demo data lives only in story routes. Imports of @/lib/demo/* from production code are not allowed.",
      from: {
        path: "^src/",
        pathNot: ["__stories__", "\\.stories\\.tsx?$"],
      },
      to: {
        path: "^src/lib/demo/",
      },
    },
  ],
  options: {
    tsConfig: { fileName: "tsconfig.json" },
    doNotFollow: { path: "node_modules" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
    },
  },
};
