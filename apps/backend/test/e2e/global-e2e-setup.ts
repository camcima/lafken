/* eslint-disable no-process-env */

function overrideEnvironmentVariables() {
  // Use mock auth provider in tests (avoids requiring AUTH_TENANT_ID/AUTH_CLIENT_ID)
  process.env["AUTH_PROVIDER"] = "mock";
}

// ================================ Vitest hooks =============================== //

export function setup() {
  overrideEnvironmentVariables();
}
