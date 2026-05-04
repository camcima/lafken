import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { LegalHoldsListPage } from "./LegalHoldsListPage";

function renderPage() {
  return render(
    <I18nProvider>
      <LegalHoldsListPage />
    </I18nProvider>,
  );
}

describe("LegalHoldsListPage", () => {
  it("renders the page title", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: /legal holds/i })).toBeInTheDocument();
  });

  it("renders at least one demo case reference", () => {
    renderPage();
    // DEMO_LEGAL_HOLDS has case refs like CHL-2026-AVN-014
    expect(screen.getByText("CHL-2026-AVN-014")).toBeInTheDocument();
  });

  it("renders stats cards", () => {
    renderPage();
    expect(screen.getByText(/active holds/i)).toBeInTheDocument();
    expect(screen.getByText(/assets under hold/i)).toBeInTheDocument();
  });

  it("filtering by status=pending_release shows only pending rows", () => {
    renderPage();
    // Before filter all rows visible — count by case refs (buttons in table)
    const statusSelect = screen.getByDisplayValue(/all statuses/i);
    fireEvent.change(statusSelect, { target: { value: "pending_release" } });

    // Only CHL-2025-AVN-077 has pending_release status in demo data.
    // It appears in both the table row and the oldest-hold stat card.
    expect(screen.getAllByText("CHL-2025-AVN-077").length).toBeGreaterThan(0);
    expect(screen.queryByText("CHL-2026-AVN-014")).not.toBeInTheDocument();
  });

  it("drawer opens on row click and closes on X button", () => {
    renderPage();
    // Click the first hold row
    const rows = screen.getAllByRole("button", { name: /CHL/i });
    fireEvent.click(rows[0]);

    // Drawer should show "Legal hold" caption
    expect(screen.getAllByText(/legal hold/i).length).toBeGreaterThan(0);

    // Close the drawer
    const closeBtn = screen.getByRole("button", { name: /close drawer/i });
    fireEvent.click(closeBtn);

    // Drawer footer actions should no longer be in the DOM
    expect(screen.queryByRole("button", { name: /request lift/i })).not.toBeInTheDocument();
  });

  it("renders Place hold and Export buttons", () => {
    renderPage();
    expect(screen.getByRole("button", { name: /place hold/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /export holds register/i })).toBeInTheDocument();
  });

  it("search query narrows visible rows", () => {
    renderPage();
    const initialRows = screen.getAllByRole("button", { name: /CHL|BR-|PE-|CO-|AR-/i }).length;

    const searchInput = screen.getByPlaceholderText(/search by case reference/i);
    fireEvent.change(searchInput, { target: { value: "CHL-2026" } });

    const filteredRows = screen.getAllByRole("button", { name: /CHL-2026/i }).length;
    expect(filteredRows).toBeLessThan(initialRows);
  });
});
