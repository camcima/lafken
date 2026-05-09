import { type APIRequestContext, expect, type Page, test } from "@playwright/test";

const REQUIRES_FAKE_GCS = process.env.LAFKEN_E2E_REQUIRES_FAKE_GCS === "true";
const REQUIRES_VIRUS_INFECTED = process.env.LAFKEN_E2E_REQUIRES_VIRUS_SCAN_INFECTED === "true";
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

/**
 * Seeds a namespace with `virusScanRequired: true` so the processing
 * worker invokes the virus-scan adapter. The local virus-scan adapter
 * flips to "infected" when the backend is started with
 * `PROCESSING_VIRUS_SCAN_FORCE_INFECTED=true` — every uploaded asset
 * then transitions to `quarantined_virus`.
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
        virusScanRequired: true,
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

test.describe("Asset upload quarantine path @requires-fake-gcs @requires-virus-infected", () => {
  test.beforeEach(() => {
    test.skip(
      !REQUIRES_FAKE_GCS || !REQUIRES_VIRUS_INFECTED,
      "Set LAFKEN_E2E_REQUIRES_FAKE_GCS=true and LAFKEN_E2E_REQUIRES_VIRUS_SCAN_INFECTED=true with the backend running with PROCESSING_VIRUS_SCAN_FORCE_INFECTED=true.",
    );
  });

  test("infected upload reaches quarantined state in the dropzone", async ({ request, page }) => {
    const stamp = String(Date.now());
    const bindingName = `e2e-binding-quarantine-${stamp}`;
    const namespaceSlug = `e2e-ns-quarantine-${stamp}`;

    const bindingId = await seedStorageBinding(request, bindingName);
    await seedNamespace(request, namespaceSlug, bindingId);

    try {
      await page.goto(`/namespaces/${namespaceSlug}?tab=assets`);
      await signInIfNeeded(page);

      await page.getByRole("button", { name: /upload assets/i }).click();
      await expect(page.getByRole("dialog")).toBeVisible();

      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles({
        name: "infected.jpg",
        mimeType: "image/jpeg",
        buffer: SAMPLE_JPEG_BUFFER,
      });

      await page.getByRole("button", { name: /start upload/i }).click();

      // The SDK lifecycle drives the tile through:
      //   uploading… → processing… → quarantined
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByText(/^quarantined$/i)).toBeVisible({ timeout: 30_000 });
    } finally {
      await archiveNamespace(request, namespaceSlug);
      await deleteStorageBinding(request, bindingName);
    }
  });
});
