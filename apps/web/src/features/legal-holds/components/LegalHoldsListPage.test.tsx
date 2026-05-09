import type { LegalHoldResponseDTO, PaginatedResult } from "@shared/backend-api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { LegalHoldsListPage } from "./LegalHoldsListPage";

// ── Sample data ─────────────────────────────────────────────────────────────

const ACTIVE_HOLD: LegalHoldResponseDTO = {
  id: "01900000-0000-7000-8000-000000000001",
  caseReference: "CHL-2026-AVN-014",
  description: "Investigation pending",
  scopeSummary: "namespace:fleet-photos",
  affectedAssetCount: 3,
  active: true,
  placedBy: "alice@example.com",
  placedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
};

const LIFTED_HOLD: LegalHoldResponseDTO = {
  id: "01900000-0000-7000-8000-000000000002",
  caseReference: "CHL-2025-AVN-099",
  description: "Closed",
  scopeSummary: "namespace:cargo-claims",
  affectedAssetCount: 1,
  active: false,
  placedBy: "bob@example.com",
  placedAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
  liftedAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
};

const PAGE: PaginatedResult<LegalHoldResponseDTO> = {
  data: [ACTIVE_HOLD, LIFTED_HOLD],
  total: 2,
  page: 1,
  limit: 25,
  lastPage: 1,
};

// ── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("@/features/legal-holds/hooks/useLegalHolds", () => ({
  useLegalHolds: () => ({ data: PAGE, isLoading: false }),
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
  useSearch: () => ({ q: undefined }),
}));

// ── Helper ──────────────────────────────────────────────────────────────────

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

// ── Tests ───────────────────────────────────────────────────────────────────

describe("LegalHoldsListPage", () => {
  it("renders the page title", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: /legal holds/i })).toBeInTheDocument();
  });

  it("renders the case reference for the active hold", () => {
    renderPage();
    expect(screen.getByText("CHL-2026-AVN-014")).toBeInTheDocument();
  });

  it("renders stats cards", () => {
    renderPage();
    expect(screen.getByText(/active holds/i)).toBeInTheDocument();
    expect(screen.getByText(/assets under hold/i)).toBeInTheDocument();
  });

  it("filtering by status=active keeps the active row visible", () => {
    renderPage();
    const statusSelect = screen.getByDisplayValue(/all statuses/i);
    fireEvent.change(statusSelect, { target: { value: "active" } });
    expect(screen.getByText("CHL-2026-AVN-014")).toBeInTheDocument();
  });

  it("filtering by status=lifted hides active rows", () => {
    renderPage();
    const statusSelect = screen.getByDisplayValue(/all statuses/i);
    fireEvent.change(statusSelect, { target: { value: "lifted" } });
    expect(screen.queryByText("CHL-2026-AVN-014")).not.toBeInTheDocument();
  });

  it("renders Place hold link", () => {
    renderPage();
    expect(screen.getByRole("link", { name: /place hold/i })).toBeInTheDocument();
  });
});
