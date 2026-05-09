import { type APIRequestContext, expect, type Page, test } from "@playwright/test";

const REQUIRES_FAKE_GCS = process.env.LAFKEN_E2E_REQUIRES_FAKE_GCS === "true";
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3000";

/**
 * Inline 268-byte minimal-valid JPEG fixture. Decoded from a known-good
 * JFIF-tagged byte sequence — providing it inline avoids needing
 * @types/node for path resolution while keeping the spec self-contained.
 */
const SAMPLE_JPEG_HEX =
  "ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffdb0043010909090c0b0c180d0d1832211c213232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232ffc00011080001000103012200021101031101ffc4001f0000010501010101010100000000000000000102030405060708090a0bffc4001f0100030101010101010101010000000000000102030405060708090a0bffda000c03010002110311003f00fbd0";

const SAMPLE_JPEG_BUFFER = Buffer.from(SAMPLE_JPEG_HEX, "hex");

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

/**
 * Seeds a storage binding via the BE API directly, bypassing the UI.
 * Returns the created binding's ID.
 */
async function seedStorageBinding(request: APIRequestContext, name: string): Promise<string> {
  const response = await request.post(`${BACKEND_URL}/v1/system/storage-bindings`, {
    data: {
      name,
      adapterType: "gcs",
      bucket: "lafken-dev",
      projectId: "fake-project-1",
    },
  });
  const status = String(response.status());
  expect(response.ok(), `seedStorageBinding failed: ${status}`).toBeTruthy();
  const body = (await response.json()) as { id: string };
  return body.id;
}

/**
 * Seeds a namespace via the BE API directly with a permissive policy that
 * allows JPEG uploads up to 1 MiB.
 */
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
  const status = String(response.status());
  expect(response.ok(), `seedNamespace failed: ${status}`).toBeTruthy();
}

/**
 * Best-effort archive cleanup for a namespace.
 */
async function archiveNamespace(request: APIRequestContext, slug: string): Promise<void> {
  await request.post(`${BACKEND_URL}/v1/namespaces/${slug}/archive`).catch(() => undefined);
}

/**
 * Best-effort delete for a storage binding.
 */
async function deleteStorageBinding(request: APIRequestContext, name: string): Promise<void> {
  await request.delete(`${BACKEND_URL}/v1/system/storage-bindings/${name}`).catch(() => undefined);
}

test.describe("Asset upload happy path @requires-fake-gcs", () => {
  test.beforeEach(() => {
    test.skip(
      !REQUIRES_FAKE_GCS,
      "Set LAFKEN_E2E_REQUIRES_FAKE_GCS=true with the backend + fake-gcs running.",
    );
  });

  test("operator uploads a JPEG, confirms, and sees the row appear", async ({ request, page }) => {
    const stamp = String(Date.now());
    const bindingName = `e2e-binding-uploads-${stamp}`;
    const namespaceSlug = `e2e-ns-uploads-${stamp}`;

    const bindingId = await seedStorageBinding(request, bindingName);
    await seedNamespace(request, namespaceSlug, bindingId);

    try {
      await page.goto(`/namespaces/${namespaceSlug}?tab=assets`);
      await signInIfNeeded(page);

      // Open upload dialog
      await page.getByRole("button", { name: /upload assets/i }).click();
      await expect(page.getByRole("dialog")).toBeVisible();

      // Select the fixture file via the file input inside the dropzone.
      // We provide the bytes inline (no on-disk fixture needed).
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles({
        name: "sample.jpg",
        mimeType: "image/jpeg",
        buffer: SAMPLE_JPEG_BUFFER,
      });

      // The file row should appear in the dialog with the chosen filename
      await expect(page.getByText(/sample\.jpg/i)).toBeVisible();

      // Trigger the upload + confirm flow
      await page.getByRole("button", { name: /start upload/i }).click();

      // The SDK lifecycle drives the tile through:
      //   uploading… → processing… → ready
      // (Asserting the terminal state is enough; intermediate frames may
      // be too quick on a local stack to reliably observe.)
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByText(/^ready$/i)).toBeVisible({ timeout: 30_000 });

      // The dialog does not auto-close on success; close it manually.
      await page.getByRole("button", { name: /cancel/i }).click();
      await expect(page.getByRole("dialog")).toBeHidden();

      // The new asset row should appear in the namespace's Assets tab list
      // with the "Ready" state badge.
      await expect(page.getByText(/^ready$/i).first()).toBeVisible({ timeout: 10_000 });
    } finally {
      await archiveNamespace(request, namespaceSlug);
      await deleteStorageBinding(request, bindingName);
    }
  });
});
