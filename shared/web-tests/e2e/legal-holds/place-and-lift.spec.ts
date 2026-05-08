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

/**
 * Uploads a JPEG via the BE upload-intent + PUT + confirm flow.
 * Returns the asset's publicId.
 */
async function uploadJpeg(request: APIRequestContext, namespaceSlug: string): Promise<string> {
  // 1. Create upload intent
  const intentRes = await request.post(`${BACKEND_URL}/v1/assets/upload-intents`, {
    data: {
      namespaceSlug,
      declaredMimeType: "image/jpeg",
      declaredSizeBytes: SAMPLE_JPEG_BUFFER.byteLength,
    },
  });
  expect(intentRes.ok(), `createUploadIntent failed: ${intentRes.status()}`).toBeTruthy();
  const intent = (await intentRes.json()) as {
    publicId: string;
    uploadUrl: string;
    uploadHeaders: Record<string, string>;
  };

  // 2. PUT the bytes directly to the signed URL (fake-GCS)
  const putRes = await request.put(intent.uploadUrl, {
    data: SAMPLE_JPEG_BUFFER,
    headers: {
      "Content-Type": "image/jpeg",
      ...intent.uploadHeaders,
    },
  });
  expect(putRes.ok(), `PUT to uploadUrl failed: ${putRes.status()}`).toBeTruthy();

  // 3. Confirm upload
  const confirmRes = await request.post(`${BACKEND_URL}/v1/assets/${intent.publicId}/confirm`, {
    data: {},
  });
  expect(confirmRes.ok(), `confirmUpload failed: ${confirmRes.status()}`).toBeTruthy();

  return intent.publicId;
}

test.describe("Slice 6: Legal holds place + lift", () => {
  test.beforeEach(() => {
    test.skip(
      !REQUIRES_FAKE_GCS,
      "Set LAFKEN_E2E_REQUIRES_FAKE_GCS=true with the backend + fake-gcs running.",
    );
  });

  test("places a hold on two assets and lifts it; the asset banner appears and disappears", async ({
    page,
    request,
  }) => {
    const stamp = String(Date.now());
    const bindingName = `e2e-binding-lh-${stamp}`;
    const namespaceSlug = `e2e-lh-${stamp}`;

    const bindingId = await seedStorageBinding(request, bindingName);
    await seedNamespace(request, namespaceSlug, bindingId);

    try {
      // ── Step 1: Upload 2 assets via BE API ──────────────────────────
      const asset1PublicId = await uploadJpeg(request, namespaceSlug);
      const asset2PublicId = await uploadJpeg(request, namespaceSlug);

      // ── Step 2: Sign in and navigate to place-hold page ─────────────
      await page.goto("/legal-holds");
      await signInIfNeeded(page);

      // Wait for the page to load
      await expect(page.getByRole("heading", { name: /legal holds/i })).toBeVisible();

      // ── Step 3: Navigate to /legal-holds/new ────────────────────────
      await page.getByRole("link", { name: /place hold/i }).click();
      await expect(page).toHaveURL(/\/legal-holds\/new$/);

      // ── Step 4: Fill the case reference ─────────────────────────────
      await page.locator("#plh-case-reference").fill("CHL-AVN-2026-E2E");

      // ── Step 5: Select the seeded namespace in the picker ───────────
      // The namespace select has aria-label "Namespace"
      await page.getByRole("combobox", { name: /namespace/i }).selectOption(namespaceSlug);

      // Wait for assets to load in the picker table
      await expect(page.locator(`code:has-text("${asset1PublicId.slice(0, 8)}")`).first()).toBeVisible({
        timeout: 15_000,
      });

      // ── Step 6: Click the "+ Search" (add) button for each asset ────
      // The page renders a button per asset row with aria-pressed="false" when not picked.
      // We scope by the row that contains each publicId prefix.
      const row1 = page.locator("tr").filter({ has: page.locator(`code:has-text("${asset1PublicId.slice(0, 8)}")`) });
      await row1.getByRole("button", { name: /search/i }).click();

      const row2 = page.locator("tr").filter({ has: page.locator(`code:has-text("${asset2PublicId.slice(0, 8)}")`) });
      await row2.getByRole("button", { name: /search/i }).click();

      // ── Step 7: Fill the description (reason) ───────────────────────
      await page.locator("#plh-description").fill(
        "Investigation per DGAC requirement — e2e fixture run.",
      );

      // ── Step 8: Check acknowledgement ───────────────────────────────
      await page.locator("#plh-acknowledged").check();

      // ── Step 9: Submit ───────────────────────────────────────────────
      // The submit button has text "Place hold" (footer.submit i18n key)
      await page.getByRole("button", { name: /place hold/i }).click();

      // ── Step 10: Verify navigation back to /legal-holds and the row ─
      await expect(page).toHaveURL(/\/legal-holds$/, { timeout: 15_000 });
      await expect(page.getByText("CHL-AVN-2026-E2E")).toBeVisible({ timeout: 10_000 });

      // ── Step 11: Open the hold drawer ───────────────────────────────
      await page.getByText("CHL-AVN-2026-E2E").first().click();

      // Drawer should open and show the hold details
      await expect(page.getByRole("dialog")).toBeVisible();

      // ── Step 12: View covered assets via the drawer link ────────────
      await page.getByRole("link", { name: /view covered assets/i }).click();

      // URL should contain legalHoldId query param
      await expect(page).toHaveURL(/\/assets.*legalHoldId=/, { timeout: 10_000 });

      // Exactly 2 assets should be listed
      // The asset rows contain the publicId codes; we assert at least 2 are visible.
      await expect(page.locator(`code:has-text("${asset1PublicId.slice(0, 8)}")`).first()).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.locator(`code:has-text("${asset2PublicId.slice(0, 8)}")`).first()).toBeVisible({
        timeout: 15_000,
      });

      // ── Step 13: Check legal-hold banner on asset detail ────────────
      await page.goto(`/assets/${asset1PublicId}`);
      await expect(page.getByText(/On legal hold/i)).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText("CHL-AVN-2026-E2E")).toBeVisible();

      // ── Step 14: Lift the hold ───────────────────────────────────────
      await page.goto("/legal-holds");
      await expect(page.getByText("CHL-AVN-2026-E2E")).toBeVisible({ timeout: 10_000 });
      await page.getByText("CHL-AVN-2026-E2E").first().click();

      // Drawer opens
      await expect(page.getByRole("dialog")).toBeVisible();

      // Click "Lift hold" button in the drawer
      await page.getByRole("dialog").getByRole("button", { name: /lift hold/i }).click();

      // The lift dialog (a different [role=dialog] div) should appear on top
      // It has a textarea for the lift reason.
      // Scope to the lift dialog to avoid selector ambiguity.
      // The lift dialog is rendered as a separate div[role="dialog"] outside the drawer.
      // We target the one that contains the "Reason for lift" label.
      const liftDialog = page
        .locator('[role="dialog"]')
        .filter({ has: page.getByText(/reason for lift/i) });
      await expect(liftDialog).toBeVisible({ timeout: 5_000 });

      await liftDialog.locator("textarea").fill("Closing the e2e investigation cleanly.");

      // Click the "Lift hold" submit button inside the lift dialog
      await liftDialog.getByRole("button", { name: /lift hold/i }).click();

      // ── Step 15: Verify dialog closes and status updates ────────────
      // The lift dialog should close (liftReason state cleared, onClose called)
      await expect(liftDialog).toBeHidden({ timeout: 10_000 });

      // After lifting, the hold should now show a non-active status badge.
      // The API flips `active` to false → "Pending release" badge renders.
      // We reload the page to let the list refresh from the server.
      await page.goto("/legal-holds");
      // The hold row should still be visible but with a non-active status.
      await expect(page.getByText("CHL-AVN-2026-E2E")).toBeVisible({ timeout: 10_000 });
      // The "Active" badge should not appear next to this hold's row.
      const holdRow = page
        .locator("button")
        .filter({ has: page.getByText("CHL-AVN-2026-E2E") })
        .first();
      await expect(holdRow.getByText(/active/i)).toHaveCount(0);

      // ── Step 16: Verify banner is gone on asset detail ──────────────
      await page.goto(`/assets/${asset1PublicId}`);
      await expect(page.getByText(/On legal hold/i)).toHaveCount(0);
    } finally {
      await archiveNamespace(request, namespaceSlug);
      await deleteStorageBinding(request, bindingName);
    }
  });
});
