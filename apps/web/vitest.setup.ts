import "@testing-library/jest-dom";

// Initialize __APP_CONFIG__ with required config values for tests
// This ensures getRuntimeValue() works without mocking in test files
Object.defineProperty(globalThis, "__APP_CONFIG__", {
  value: Object.freeze({
    ENVIRONMENT: "intg",
    AUTH_PROVIDER: "mock",
    API_URL: "http://localhost:3001",
    AZURE_CLIENT_ID: "",
    AZURE_REDIRECT_URI: "",
    AZURE_TENANT_ID: "",
    AZURE_POST_LOGOUT_REDIRECT_URI: "",
    MONITORING_URL: "http://localhost:3000",
  }),
  writable: true, // allow test overrides via beforeEach
  configurable: true,
  enumerable: true,
});
