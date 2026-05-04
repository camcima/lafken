import { type Page, expect, test } from "@playwright/test";

const REQUIRES_FAKE_GCS = process.env.LAFKEN_E2E_REQUIRES_FAKE_GCS === "true";

/**
 * Drives the mock-auth login flow if the SPA redirected to /auth/login.
 * Under AUTH_PROVIDER=mock the welcome screen still requires an explicit
 * "Sign in" click; after that the mock provider authenticates immediately.
 */
async function signInIfNeeded(page: Page): Promise<void> {
  if (/\/auth\/login/.test(page.url())) {
    await page.getByRole("button", { name: /sign in/i }).click();
  }
}

async function gotoSystemPage(page: Page): Promise<void> {
  await page.goto("/system");
  await signInIfNeeded(page);
  await expect(page).toHaveURL(/\/system/);
}

async function createBindingViaUi(
  page: Page,
  options: { name: string; bucket: string; projectId?: string; prefix?: string },
): Promise<void> {
  await page.getByRole("button", { name: /add binding/i }).click();
  await page.getByLabel(/^name$/i).fill(options.name);
  await page.getByLabel(/^bucket$/i).fill(options.bucket);
  await page.getByLabel(/gcp project id/i).fill(options.projectId ?? "fake-project");
  if (options.prefix !== undefined) {
    await page.getByLabel(/prefix/i).fill(options.prefix);
  }
  await page.getByRole("button", { name: /^save$/i }).click();
}

test.describe("Storage bindings @requires-fake-gcs", () => {
  test.beforeEach(async () => {
    test.skip(
      !REQUIRES_FAKE_GCS,
      "Set LAFKEN_E2E_REQUIRES_FAKE_GCS=true with the backend + fake-gcs running.",
    );
  });

  test("operator can add a storage binding pointing at lafken-dev", async ({ page }) => {
    await gotoSystemPage(page);

    await createBindingViaUi(page, {
      name: "e2e-binding",
      bucket: "lafken-dev",
      projectId: "fake-project",
    });

    await expect(page.getByText("e2e-binding")).toBeVisible();
  });

  test("operator sees an error when the bucket does not exist", async ({ page }) => {
    await gotoSystemPage(page);

    await createBindingViaUi(page, {
      name: "e2e-bad-bucket",
      bucket: "definitely-not-here",
      projectId: "fake-project",
    });

    await expect(page.getByText(/does not exist/i)).toBeVisible();
  });

  test("operator can delete a storage binding", async ({ page }) => {
    await gotoSystemPage(page);

    // Setup: create a binding so we have something to delete.
    await createBindingViaUi(page, {
      name: "e2e-to-delete",
      bucket: "lafken-dev",
      projectId: "fake-project",
    });
    await expect(page.getByText("e2e-to-delete")).toBeVisible();

    // Open the row's delete control and confirm in the dialog.
    await page
      .getByRole("row", { name: /e2e-to-delete/i })
      .getByRole("button", { name: /delete/i })
      .click();
    await page.getByRole("button", { name: /^delete$/i }).click();

    await expect(page.getByText("e2e-to-delete")).not.toBeVisible();
  });
});
