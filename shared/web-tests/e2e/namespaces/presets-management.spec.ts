import { type APIRequestContext, expect, type Page, test } from "@playwright/test";

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
 * Seeds a storage binding via the BE API.
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
 * Seeds a namespace via the BE API.
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
async function archiveNamespace(request: APIRequestContext, slug: string): Promise<void> {
  await request.post(`${BACKEND_URL}/namespaces/${slug}/archive`).catch(() => undefined);
}

/**
 * Deletes a storage binding via the BE API for cleanup.
 */
async function deleteStorageBinding(request: APIRequestContext, name: string): Promise<void> {
  await request.delete(`${BACKEND_URL}/system/storage-bindings/${name}`).catch(() => undefined);
}

test.describe("presets management", () => {
  test("operator creates, edits, deactivates, and reactivates a preset", async ({
    request,
    page,
  }) => {
    const bindingName = `e2e-binding-presets-${String(Date.now())}`;
    const namespaceSlug = `e2e-ns-presets-${String(Date.now())}`;
    const presetName = "thumbnail";

    let bindingId: string | undefined;

    try {
      // 1. Seed storage binding + namespace via BE API
      bindingId = await seedStorageBinding(request, bindingName);
      await seedNamespace(request, namespaceSlug, bindingId);

      // 2. Sign in and navigate to the presets tab
      await page.goto(`/namespaces/${namespaceSlug}?tab=presets`);
      await signInIfNeeded(page);
      await expect(page).toHaveURL(new RegExp(`/namespaces/${namespaceSlug}`));

      // 3. Click "New preset" and fill the form
      await page.getByRole("link", { name: /new preset/i }).click();
      await expect(page).toHaveURL(new RegExp(`/namespaces/${namespaceSlug}/presets/new`));

      await page.getByLabel(/^name$/i).fill(presetName);
      await page.getByLabel(/width/i).fill("1080");
      await page.getByLabel(/height/i).fill("720");
      await page.getByLabel(/fit/i).selectOption("cover");
      await page.getByLabel(/format/i).selectOption("webp");
      await page.getByLabel(/quality/i).fill("80");

      await page.getByRole("button", { name: /create preset/i }).click();

      // 4. Assert URL returns to presets tab and the preset row appears as v1 active
      await expect(page).toHaveURL(new RegExp(`/namespaces/${namespaceSlug}`));
      await expect(page.getByText(presetName)).toBeVisible();
      await expect(page.getByText("v1")).toBeVisible();
      await expect(page.getByText(/^active$/i)).toBeVisible();

      // 5. Click Edit and change quality to 70
      await page.getByRole("link", { name: /edit/i }).click();
      await expect(page).toHaveURL(
        new RegExp(`/namespaces/${namespaceSlug}/presets/${presetName}/edit`),
      );

      const qualityInput = page.getByLabel(/quality/i);
      await qualityInput.clear();
      await qualityInput.fill("70");

      await page.getByRole("button", { name: /save preset/i }).click();

      // 6. Assert the row now shows v2 and updated summary
      await expect(page).toHaveURL(new RegExp(`/namespaces/${namespaceSlug}`));
      await expect(page.getByText("v2")).toBeVisible();

      // 7. Open past-versions and assert v1 is listed
      await page.getByRole("link", { name: /edit/i }).click();
      await expect(page.getByText(/past versions/i)).toBeVisible();
      await expect(page.getByRole("button", { name: /v1/ })).toBeVisible();
      await page.goBack();

      // 8. Toggle the active switch off — assert the row shows Inactive
      const activeSwitch = page.getByRole("switch");
      await activeSwitch.click();
      await expect(page.getByText(/inactive/i)).toBeVisible();

      // 9. Toggle on — assert it shows Active again
      await activeSwitch.click();
      await expect(page.getByText(/^active$/i)).toBeVisible();
    } finally {
      await archiveNamespace(request, namespaceSlug);
      if (bindingId !== undefined) {
        await deleteStorageBinding(request, bindingName);
      }
    }
  });
});
