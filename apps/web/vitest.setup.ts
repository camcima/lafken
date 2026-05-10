import "@testing-library/jest-dom";

// Initialize __APP_CONFIG__ with required config values for tests.
// This ensures getRuntimeValue() works without mocking in test files.
Object.defineProperty(globalThis, "__APP_CONFIG__", {
  value: Object.freeze({
    ENVIRONMENT: "intg",
    AUTH_PROVIDER: "oidc",
    API_URL: "http://localhost:3001",
    OIDC_AUTHORITY: "",
    OIDC_CLIENT_ID: "",
    OIDC_AUDIENCE: "",
    OIDC_REDIRECT_URI: "",
    OIDC_POST_LOGOUT_REDIRECT_URI: "",
    OIDC_SCOPES: "openid profile email",
    MONITORING_URL: "http://localhost:3000",
  }),
  writable: true, // allow test overrides via beforeEach
  configurable: true,
  enumerable: true,
});
