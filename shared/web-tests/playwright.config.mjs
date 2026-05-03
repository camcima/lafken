import { defineConfig, devices } from "@playwright/test";

// eslint-disable-next-line no-undef
const CI = process.env.CI ?? false;
// eslint-disable-next-line no-undef
const IS_DEV = process.env.DEV === "true";
const SERVICE_PORT = IS_DEV ? 5173 : 4173;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./e2e",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!CI,
  /* Retry on CI only */
  retries: CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: "html",
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    baseURL: `http://localhost:${SERVICE_PORT}`,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },

    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },

    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: getWebServerConfig(),
});

function getWebServerConfig(timeout = 60000) {
  // Preview mode serves dist/, which needs a generated config.js to
  // bootstrap getRuntimeValue(). The dev server uses the
  // vite-dev-runtime-config plugin instead.
  const previewCommand =
    "cd ../../apps/web && AUTH_PROVIDER=mock node scripts/generate-test-config.js && pnpm preview";
  const command = IS_DEV ? "cd ../../apps/web && pnpm dev" : previewCommand;
  const url = `http://localhost:${SERVICE_PORT}`;
  const reuseExistingServer = !CI;

  return {
    timeout,
    command,
    url,
    reuseExistingServer,
  };
}
