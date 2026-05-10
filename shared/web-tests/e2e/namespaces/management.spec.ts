import { type APIRequestContext, expect, type Page, test } from "@playwright/test";

const REQUIRES_FAKE_GCS = process.env.LAFKEN_E2E_REQUIRES_FAKE_GCS === "true";
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3000";

/**
 * Handles the login flow if the SPA redirected to /auth/login.
 * Clicks "Sign in" on the login page to initiate the OIDC flow.
 */
async function signInIfNeeded(page: Page): Promise<void> {
  if (/\/auth\/login/.test(page.url())) {
    await page.getByRole("button", { name: /sign in/i }).click();
  }
}

async function gotoNamespacesPage(page: Page): Promise<void> {
  await page.goto("/namespaces");
  await signInIfNeeded(page);
  await expect(page).toHaveURL(/\/namespaces/);
}

/**
 * Seeds a storage binding via the BE API directly, bypassing the UI.
 * Returns the created binding's ID.
 */
async function seedStorageBinding(request: APIRequestContext, name: string): Promise<string> {
  const response = await request.post(`${BACKEND_URL}/system/storage-bindings`, {
    data: {
      name,
      adapterType: "gcs",
      bucket: "lafken-dev",
      projectId: "fake-project",
    },
  });
  const body = (await response.json()) as { id: string };
  return body.id;
}

/**
 * Seeds a namespace via the BE API directly.
 * Returns the created namespace slug.
 */
async function seedNamespace(
  request: APIRequestContext,
  slug: string,
  storageBindingId: string,
): Promise<string> {
  await request.post(`${BACKEND_URL}/namespaces`, {
    data: {
      slug,
      displayName: `E2E Namespace ${slug}`,
      storageBindingId,
      policy: {
        retentionDays: null,
        retentionMode: "none",
        maxFileSizeBytes: 26214400,
        allowedMimeTypes: ["image/jpeg", "image/png"],
        exifHandling: "strip",
        virusScanRequired: false,
        contentModeration: null,
        requiredMetadataSchema: null,
        immutable: false,
        servingMode: "public",
        signedUrlTtlSeconds: null,
        signedUrlBucketSize: null,
        retryConfig: null,
      },
    },
  });
  return slug;
}

/**
 * Deletes a namespace via the BE API for cleanup.
 * No-ops if the namespace does not exist (404).
 */
async function deleteNamespace(request: APIRequestContext, slug: string): Promise<void> {
  // Best-effort cleanup — archive then ignore errors
  await request.post(`${BACKEND_URL}/namespaces/${slug}/archive`).catch(() => undefined);
}

/**
 * Deletes a storage binding via the BE API for cleanup.
 */
async function deleteStorageBinding(request: APIRequestContext, name: string): Promise<void> {
  await request.delete(`${BACKEND_URL}/system/storage-bindings/${name}`).catch(() => undefined);
}

test.describe("Namespace management @requires-fake-gcs", () => {
  test.beforeEach(() => {
    test.skip(
      !REQUIRES_FAKE_GCS,
      "Set LAFKEN_E2E_REQUIRES_FAKE_GCS=true with the backend + fake-gcs running.",
    );
  });

  test("operator can create a namespace and is taken to the detail page", async ({
    page,
    request,
  }) => {
    const bindingName = `e2e-binding-create-${String(Date.now())}`;
    const namespaceSlug = `e2e-ns-create-${String(Date.now())}`;

    let bindingId: string | undefined;

    try {
      bindingId = await seedStorageBinding(request, bindingName);

      await gotoNamespacesPage(page);

      // Navigate to the new namespace form
      await page.getByRole("link", { name: /new namespace/i }).click();
      await expect(page).toHaveURL(/\/namespaces\/new/);

      // Fill in the required identity fields
      await page.getByLabel(/^slug$/i).fill(namespaceSlug);
      await page.getByLabel(/display name/i).fill(`E2E Namespace ${namespaceSlug}`);

      // Select the storage binding
      await page.getByLabel(/storage binding/i).click();
      await page.getByRole("option", { name: new RegExp(bindingName, "i") }).click();

      // Submit the form
      await page.getByRole("button", { name: /create namespace/i }).click();

      // Assert we land on the detail page for the created namespace
      await expect(page).toHaveURL(new RegExp(`/namespaces/${namespaceSlug}`));
    } finally {
      await deleteNamespace(request, namespaceSlug);
      if (bindingId !== undefined) {
        await deleteStorageBinding(request, bindingName);
      }
    }
  });

  test("operator can edit namespace metadata via the drawer", async ({ page, request }) => {
    const bindingName = `e2e-binding-edit-${String(Date.now())}`;
    const namespaceSlug = `e2e-ns-edit-${String(Date.now())}`;
    const updatedDisplayName = `Updated Display Name ${String(Date.now())}`;

    let bindingId: string | undefined;

    try {
      bindingId = await seedStorageBinding(request, bindingName);
      await seedNamespace(request, namespaceSlug, bindingId);

      // Navigate to the namespace detail page
      await page.goto(`/namespaces/${namespaceSlug}`);
      await signInIfNeeded(page);
      await expect(page).toHaveURL(new RegExp(`/namespaces/${namespaceSlug}`));

      // Open the edit metadata drawer/action
      await page.getByRole("button", { name: /edit metadata/i }).click();

      // Update display name in the form
      const displayNameField = page.getByLabel(/display name/i);
      await displayNameField.clear();
      await displayNameField.fill(updatedDisplayName);

      // Save
      await page.getByRole("button", { name: /^save$/i }).click();

      // Assert the updated display name is visible on the page
      await expect(page.getByText(updatedDisplayName)).toBeVisible();
    } finally {
      await deleteNamespace(request, namespaceSlug);
      if (bindingId !== undefined) {
        await deleteStorageBinding(request, bindingName);
      }
    }
  });

  test("operator can archive and then unarchive a namespace", async ({ page, request }) => {
    const bindingName = `e2e-binding-archive-${String(Date.now())}`;
    const namespaceSlug = `e2e-ns-archive-${String(Date.now())}`;

    let bindingId: string | undefined;

    try {
      bindingId = await seedStorageBinding(request, bindingName);
      await seedNamespace(request, namespaceSlug, bindingId);

      // Navigate to the namespace detail page
      await page.goto(`/namespaces/${namespaceSlug}`);
      await signInIfNeeded(page);
      await expect(page).toHaveURL(new RegExp(`/namespaces/${namespaceSlug}`));

      // Archive the namespace
      await page.getByRole("button", { name: /archive/i }).click();

      // Confirm in the dialog
      await page.getByRole("button", { name: /confirm/i }).click();

      // Assert the archived badge appears
      await expect(page.getByText(/archived/i)).toBeVisible();

      // Unarchive the namespace
      await page.getByRole("button", { name: /unarchive/i }).click();

      // Confirm in the dialog
      await page.getByRole("button", { name: /confirm/i }).click();

      // Assert the archived badge is gone
      await expect(page.getByText(/archived/i)).toBeHidden();
    } finally {
      // Namespace was unarchived; delete it (archive then clean up binding)
      await deleteNamespace(request, namespaceSlug);
      if (bindingId !== undefined) {
        await deleteStorageBinding(request, bindingName);
      }
    }
  });
});
