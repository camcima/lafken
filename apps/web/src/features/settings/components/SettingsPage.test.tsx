import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { renderWithRouter } from "@/lib/test/render-with-router";
import { settingsSearchSchema } from "@/routes/_protected/settings";

import { SettingsPage } from "./SettingsPage";

afterEach(cleanup);

function renderPage(initialUrl = "/settings") {
  return renderWithRouter(
    {
      path: "settings",
      index: false,
      component: SettingsPage,
      validateSearch: settingsSearchSchema,
    },
    initialUrl,
  );
}

describe("SettingsPage", () => {
  it("renders the title and tab strip", async () => {
    await renderPage();
    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/members & roles/i)).toBeInTheDocument();
  });

  it("shows the honest not-configured empty state instead of demo data", async () => {
    await renderPage();
    expect(await screen.findByText(/not configured yet/i)).toBeInTheDocument();
    // The old fake workspace rows must be gone.
    expect(screen.queryByText(/sa-east-1/i)).not.toBeInTheDocument();
  });
});
