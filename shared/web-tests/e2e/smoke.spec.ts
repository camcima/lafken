import { expect, test } from "@playwright/test";

test.describe("smoke — app boots and the auth gate works", () => {
  test("/ while unauthenticated redirects to /auth/login with redirect preserved", async ({
    page,
  }) => {
    await page.goto("/");

    // / is protected; the layout should send us to /auth/login with redirect=%2F
    await expect(page).toHaveURL(/\/auth\/login\?redirect=/);
    const url = new URL(page.url());
    expect(url.searchParams.get("redirect")).toBe("/");

    // The login welcome screen should render
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("an arbitrary protected path redirects with the path preserved", async ({ page }) => {
    await page.goto("/some/deep/path");

    await expect(page).toHaveURL(/\/auth\/login\?redirect=/);
    const url = new URL(page.url());
    expect(url.searchParams.get("redirect")).toContain("/some/deep/path");
  });

  test("login page is reachable directly and runtime config loads cleanly", async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    await page.goto("/auth/login?redirect=/some-protected-area");

    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();

    const url = new URL(page.url());
    expect(url.searchParams.get("redirect")).toBe("/some-protected-area");

    // Runtime config must have loaded — getRuntimeValue() throws otherwise
    const appConfig = await page.evaluate(
      () => (globalThis as unknown as { __APP_CONFIG__?: unknown }).__APP_CONFIG__,
    );
    expect(appConfig).toBeDefined();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
