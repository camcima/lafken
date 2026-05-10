/* eslint-disable no-process-env */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DEV_OIDC_BASE_URL = "http://localhost:8095";

async function ensureDevOidcReachable(): Promise<void> {
  const response = await fetch(`${DEV_OIDC_BASE_URL}/.well-known/openid-configuration`).catch(
    (err: unknown) => {
      throw new Error(
        `dev-oidc unreachable at ${DEV_OIDC_BASE_URL}. Run \`docker compose -f apps/backend/docker-compose.test.yml up -d\` first. Cause: ${String(err)}`,
      );
    },
  );
  if (!response.ok) {
    throw new Error(
      `dev-oidc returned ${response.status}. Run \`docker compose -f apps/backend/docker-compose.test.yml up -d\` first.`,
    );
  }
}

function overrideEnvironmentVariables() {
  // OIDC provider — dev-oidc container handles token issuance in tests
  process.env["AUTH_PROVIDER"] = "oidc";

  // Configure imgproxy signer with deterministic dummy values so that the
  // GET /v1/assets/:publicId/preview-url endpoint can mint signed URLs in
  // e2e tests. The crypto-only signer never makes a network call, so dummy
  // hex values are sufficient — and we don't need a running imgproxy.
  if (!process.env["IMGPROXY_BASE_URL"]) {
    process.env["IMGPROXY_BASE_URL"] = "http://imgproxy.test";
  }
  if (!process.env["IMGPROXY_KEY"]) {
    process.env["IMGPROXY_KEY"] = "deadbeef";
  }
  if (!process.env["IMGPROXY_SALT"]) {
    process.env["IMGPROXY_SALT"] = "cafebabe";
  }

  // When fake-gcs is enabled, the GCS asset storage adapter signs upload URLs
  // with a v4 signature derived from a service-account key. Inject the test
  // service-account JSON (which wraps the same RSA key fake-gcs is configured
  // with via -private-key-location) so the signing path produces URLs that
  // fake-gcs accepts.
  if (process.env["LAFKEN_E2E_REQUIRES_FAKE_GCS"] === "true") {
    const credentialsPath = join(__dirname, "..", "fixtures", "fake-gcs-credentials.json");
    process.env["GCS_SERVICE_ACCOUNT_JSON"] = readFileSync(credentialsPath, "utf8");
  }
}

// ================================ Vitest hooks =============================== //

export async function setup() {
  await ensureDevOidcReachable();
  overrideEnvironmentVariables();
}
