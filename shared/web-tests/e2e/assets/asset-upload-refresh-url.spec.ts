import { type APIRequestContext, expect, type Page, test } from "@playwright/test";

const REQUIRES_FAKE_GCS = process.env.LAFKEN_E2E_REQUIRES_FAKE_GCS === "true";
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3000";

const SAMPLE_JPEG_HEX =
  "ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffdb0043010909090c0b0c180d0d1832211c213232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232ffc00011080001000103012200021101031101ffc4001f0000010501010101010100000000000000000102030405060708090a0bffc4001f0100030101010101010101010000000000000102030405060708090a0bffda000c03010002110311003f00fbd0";

const SAMPLE_JPEG_BUFFER = Buffer.from(SAMPLE_JPEG_HEX, "hex");

async function signInIfNeeded(page: Page): Promise<void> {
  if (/\/auth\/login/.test(page.url())) {
    await page.getByRole("button", { name: /sign in/i }).click();
  }
}

async function seedStorageBinding(request: APIRequestContext, name: string): Promise<string> {
  const response = await request.post(`${BACKEND_URL}/v1/system/storage-bindings`, {
    data: {
      name,
      adapterType: "gcs",
      bucket: "lafken-dev",
      projectId: "fake-project-1",
    },
  });
  expect(response.ok(), `seedStorageBinding failed: ${String(response.status())}`).toBeTruthy();
  const body = (await response.json()) as { id: string };
  return body.id;
}

async function seedNamespace(
  request: APIRequestContext,
  slug: string,
  storageBindingId: string,
): Promise<void> {
  const response = await request.post(`${BACKEND_URL}/v1/namespaces`, {
    data: {
      slug,
      displayName: `E2E ${slug}`,
      storageBindingId,
      policy: {
        retentionDays: null,
        retentionMode: "none",
        maxFileSizeBytes: 1_048_576,
        allowedMimeTypes: ["image/jpeg", "image/png"],
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
  expect(response.ok(), `seedNamespace failed: ${String(response.status())}`).toBeTruthy();
}

async function archiveNamespace(request: APIRequestContext, slug: string): Promise<void> {
  await request.post(`${BACKEND_URL}/v1/namespaces/${slug}/archive`).catch(() => undefined);
}

async function deleteStorageBinding(request: APIRequestContext, name: string): Promise<void> {
  await request.delete(`${BACKEND_URL}/v1/system/storage-bindings/${name}`).catch(() => undefined);
}

test.describe("Asset upload refresh-url path @requires-fake-gcs", () => {
  test.beforeEach(() => {
    test.skip(
      !REQUIRES_FAKE_GCS,
      "Set LAFKEN_E2E_REQUIRES_FAKE_GCS=true with the backend + fake-gcs running.",
    );
  });

  test("SDK refreshes signed URL when expiresAt is within safety margin", async ({
    request,
    page,
  }) => {
    const stamp = String(Date.now());
    const bindingName = `e2e-binding-refresh-${stamp}`;
    const namespaceSlug = `e2e-ns-refresh-${stamp}`;

    const bindingId = await seedStorageBinding(request, bindingName);
    await seedNamespace(request, namespaceSlug, bindingId);

    let refreshCallCount = 0;

    // Intercept the create-upload-intent response to backdate `expiresAt`
    // so the SDK considers the URL stale immediately and triggers
    // `client.assets.refreshUploadUrl` before the PUT.
    await page.route(`**/v1/assets/upload-intents`, async (route) => {
      const response = await route.fetch();
      const body = (await response.json()) as Record<string, unknown>;
      const stale = new Date(Date.now() + 1_000).toISOString();
      await route.fulfill({
        response,
        json: { ...body, expiresAt: stale },
      });
    });

    // Count refresh calls
    await page.route(`**/v1/assets/upload-intents/*/refresh-url`, async (route) => {
      refreshCallCount += 1;
      await route.continue();
    });

    try {
      await page.goto(`/namespaces/${namespaceSlug}?tab=assets`);
      await signInIfNeeded(page);

      await page.getByRole("button", { name: /upload assets/i }).click();
      await expect(page.getByRole("dialog")).toBeVisible();

      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles({
        name: "refresh.jpg",
        mimeType: "image/jpeg",
        buffer: SAMPLE_JPEG_BUFFER,
      });

      await page.getByRole("button", { name: /start upload/i }).click();

      const dialog = page.getByRole("dialog");
      await expect(dialog.getByText(/^ready$/i)).toBeVisible({ timeout: 30_000 });

      // The SDK should have called refresh-url at least once because
      // every fresh intent comes back with a near-expired URL.
      expect(
        refreshCallCount,
        "expected SDK to call refresh-url when expiresAt is within safety margin",
      ).toBeGreaterThanOrEqual(1);
    } finally {
      await archiveNamespace(request, namespaceSlug);
      await deleteStorageBinding(request, bindingName);
    }
  });
});
