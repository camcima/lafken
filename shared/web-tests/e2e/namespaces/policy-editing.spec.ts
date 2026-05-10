import { type APIRequestContext, expect, type Page, test } from "@playwright/test";

const REQUIRES_FAKE_GCS = process.env.LAFKEN_E2E_REQUIRES_FAKE_GCS === "true";
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3000";

/**
 * Drives the mock-auth login flow if the SPA redirected to /auth/login.
 */
async function signInIfNeeded(page: Page): Promise<void> {
  if (/\/auth\/login/.test(page.url())) {
    await page.getByRole("button", { name: /sign in/i }).click();
  }
}

/**
 * Seeds a storage binding via the BE API directly.
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
 */
async function seedNamespace(
  request: APIRequestContext,
  slug: string,
  storageBindingId: string,
): Promise<void> {
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
}

/**
 * Archives a namespace via the BE API for cleanup.
 */
async function deleteNamespace(request: APIRequestContext, slug: string): Promise<void> {
  await request.post(`${BACKEND_URL}/namespaces/${slug}/archive`).catch(() => undefined);
}

/**
 * Deletes a storage binding via the BE API for cleanup.
 */
async function deleteStorageBinding(request: APIRequestContext, name: string): Promise<void> {
  await request.delete(`${BACKEND_URL}/system/storage-bindings/${name}`).catch(() => undefined);
}

test.describe("Namespace policy editing @requires-fake-gcs", () => {
  test.beforeEach(() => {
    test.skip(
      !REQUIRES_FAKE_GCS,
      "Set LAFKEN_E2E_REQUIRES_FAKE_GCS=true with the backend + fake-gcs running.",
    );
  });

  test("operator edits a namespace policy and detail page reflects the new version", async ({
    page,
    request,
  }) => {
    const bindingName = `e2e-binding-policy-${String(Date.now())}`;
    const namespaceSlug = `e2e-ns-policy-${String(Date.now())}`;

    let bindingId: string | undefined;

    try {
      // 1. Seed a storage binding + namespace via BE API.
      bindingId = await seedStorageBinding(request, bindingName);
      await seedNamespace(request, namespaceSlug, bindingId);

      // 2. Navigate to the namespace detail page.
      await page.goto(`/namespaces/${namespaceSlug}`);
      await signInIfNeeded(page);
      await expect(page).toHaveURL(new RegExp(`/namespaces/${namespaceSlug}`));

      // 3. Click Edit policy — should navigate to /namespaces/<slug>/policy/edit.
      await page.getByRole("link", { name: /edit policy/i }).click();
      await expect(page).toHaveURL(new RegExp(`/namespaces/${namespaceSlug}/policy/edit`));

      // 4. Change retentionDays from blank/null to 90.
      const retentionDaysInput = page.locator("#ep-retention-days");
      await retentionDaysInput.clear();
      await retentionDaysInput.fill("90");

      // 5. Click Save. Assert URL returns to namespace detail page.
      await page.getByRole("button", { name: /save policy/i }).click();
      await expect(page).toHaveURL(new RegExp(`/namespaces/${namespaceSlug}($|\\?)`));

      // 6. Navigate to the policy tab if not already there.
      const policyTab = page.getByRole("tab", { name: /^policy$/i });
      if (await policyTab.isVisible()) {
        await policyTab.click();
      }

      // Assert the Policy tab shows version 2 header.
      await expect(page.getByText(/policy v2/i)).toBeVisible();

      // Assert retentionDays = 90 is shown in the policy grid.
      await expect(page.getByText("90")).toBeVisible();

      // 7. Assert the past-versions panel includes v1.
      await expect(page.getByRole("button", { name: /v1/i })).toBeVisible();
    } finally {
      await deleteNamespace(request, namespaceSlug);
      if (bindingId !== undefined) {
        await deleteStorageBinding(request, bindingName);
      }
    }
  });
});
