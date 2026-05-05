/* eslint-disable no-process-env */

import { readFileSync } from "node:fs";
import { join } from "node:path";

function overrideEnvironmentVariables() {
  // Use mock auth provider in tests (avoids requiring AUTH_TENANT_ID/AUTH_CLIENT_ID)
  process.env["AUTH_PROVIDER"] = "mock";

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

export function setup() {
  overrideEnvironmentVariables();
}
