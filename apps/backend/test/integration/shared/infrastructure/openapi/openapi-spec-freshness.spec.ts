import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// This gate spawns the *actual* `nest start --entryFile ./scripts/generate-openapi-spec`
// process twice (local + Cloud Endpoints flavours) — the exact command `pnpm
// generate-openapi-spec` / `pnpm postgenerate-openapi-spec` run — and diffs the
// output against the committed artifacts. It intentionally does not reimplement
// the module-compilation logic in-process: doing so would depend on this test
// project's global `environmentConfiguration` mock (see test/integration/setup.ts),
// which always reports `CLOUD_ENDPOINT_DEFINITION: false` and can't exercise the
// Cloud Endpoints flavour. Spawning the real CLI guarantees this test fails
// exactly when a developer's local `pnpm generate-openapi-spec` would fail or
// produce a diff.
const BACKEND_ROOT = path.resolve(__dirname, "../../../../..");
const LOCAL_SPEC_PATH = path.join(BACKEND_ROOT, "docs/be-openapi.yaml");
const CLOUD_SPEC_PATH = path.join(BACKEND_ROOT, "deploy/endpoints/openapi.yaml.erb");

function generateSpec(options: { outputPath: string; cloudEndpointDefinition: boolean }): void {
  execFileSync(
    "pnpm",
    [
      "exec",
      "nest",
      "start",
      "--path",
      "tsconfig.json",
      "--entryFile",
      "./scripts/generate-openapi-spec",
    ],
    {
      cwd: BACKEND_ROOT,
      env: {
        // eslint-disable-next-line no-process-env -- forwarded to the spawned generator subprocess, not read as config
        ...process.env,
        OPENAPI_SPEC_OUTPUT_PATH: options.outputPath,
        CLOUD_ENDPOINT_DEFINITION: options.cloudEndpointDefinition ? "true" : "false",
      },
      stdio: "pipe",
    },
  );
}

describe("OpenAPI spec freshness", () => {
  test("the committed OpenAPI artifacts match a freshly generated spec (run `pnpm generate-openapi-spec` and `pnpm postgenerate-openapi-spec` and commit the result if this fails)", () => {
    const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), "openapi-spec-freshness-"));

    try {
      const freshLocalPath = path.join(scratchDir, "be-openapi.yaml");
      const freshCloudPath = path.join(scratchDir, "openapi.yaml.erb");

      generateSpec({ outputPath: freshLocalPath, cloudEndpointDefinition: false });
      generateSpec({ outputPath: freshCloudPath, cloudEndpointDefinition: true });

      const freshLocalSpec = fs.readFileSync(freshLocalPath, "utf-8");
      const freshCloudSpec = fs.readFileSync(freshCloudPath, "utf-8");
      const committedLocalSpec = fs.readFileSync(LOCAL_SPEC_PATH, "utf-8");
      const committedCloudSpec = fs.readFileSync(CLOUD_SPEC_PATH, "utf-8");

      expect(committedLocalSpec).toBe(freshLocalSpec);
      expect(committedCloudSpec).toBe(freshCloudSpec);
    } finally {
      fs.rmSync(scratchDir, { recursive: true, force: true });
    }
  }, 180_000);
});
