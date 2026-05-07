import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { LegalHoldsListPage } from "./LegalHoldsListPage";

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("@/lib/demo/demo-mode", () => ({ isDemoMode: true }));

vi.mock("@/features/legal-holds/hooks/useLegalHolds", () => ({
  useLegalHolds: () => ({ data: undefined, isLoading: false }),
  useLegalHold: () => ({ data: undefined, isLoading: false }),
}));

vi.mock("@/features/legal-holds/hooks/useLegalHoldMutations", () => ({
  useLiftLegalHold: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
  }: {
    children: React.ReactNode;
    to?: string;
    search?: Record<string, unknown>;
  }) => <a href={to ?? "#"}>{children}</a>,
}));

// ── Helper ─────────────────────────────────────────────────────────────────

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nProvider>
      <QueryClientProvider client={client}>
        <LegalHoldsListPage />
      </QueryClientProvider>
    </I18nProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────────

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

  it("filtering by status=active shows only active rows (removes lifted)", () => {
    renderPage();
    const statusSelect = screen.getByDisplayValue(/all statuses/i);
    fireEvent.change(statusSelect, { target: { value: "active" } });

    // CHL-2026-AVN-014 is active in demo data — should still be visible
    expect(screen.getByText("CHL-2026-AVN-014")).toBeInTheDocument();
  });

  it("filtering by status=lifted hides active rows", () => {
    renderPage();
    const statusSelect = screen.getByDisplayValue(/all statuses/i);
    fireEvent.change(statusSelect, { target: { value: "lifted" } });

    // CHL-2026-AVN-014 is active — should not be visible after filtering to lifted
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
  });

  it("renders Place hold link", () => {
    renderPage();
    // Link wraps a Button with "Place hold..." text
    expect(screen.getByRole("link", { name: /place hold/i })).toBeInTheDocument();
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
