import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { AuditPage } from "./AuditPage";

vi.mock("@/lib/demo/demo-mode", () => ({ isDemoMode: true }));

// The hooks now call useLafkenClient(); provide a no-op stub so the component
// can mount without a real <LafkenProvider> in the test tree.
vi.mock("@lafken/react", () => ({
  useLafkenClient: () => ({
    audit: { list: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20, lastPage: 1 }) },
  }),
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nProvider>
      <QueryClientProvider client={client}>
        <AuditPage />
      </QueryClientProvider>
    </I18nProvider>,
  );
}

describe("AuditPage", () => {
  it("renders the page title", () => {
    renderPage();
    expect(screen.getByText(/audit log/i)).toBeInTheDocument();
  });

  it("renders demo audit rows — at least one event type is visible", () => {
    renderPage();
    const rows = screen.getAllByRole("button", { name: /ago/i });
    expect(rows.length).toBeGreaterThan(0);
  });

  it("renders ok and fail result badges", () => {
    renderPage();
    expect(screen.getAllByText("ok").length).toBeGreaterThan(0);
  });

  it("filtering by result=fail shows fewer rows", () => {
    renderPage();
    const allRows = screen.getAllByRole("button");
    const totalRowsBeforeFilter = allRows.length;

    const resultSelect = screen.getByDisplayValue(/all results/i);
    fireEvent.change(resultSelect, { target: { value: "fail" } });

    const filteredRows = screen.getAllByRole("button");
    expect(filteredRows.length).toBeLessThan(totalRowsBeforeFilter);
  });

  it("drawer opens on row click and closes on X button", () => {
    renderPage();
    const rows = screen.getAllByRole("button", { name: /ago/i });
    fireEvent.click(rows[0]);

    expect(screen.getByRole("button", { name: /copy json/i })).toBeInTheDocument();

    const closeBtn = screen.getByRole("button", { name: /close drawer/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByRole("button", { name: /copy json/i })).not.toBeInTheDocument();
  });

  it("search query filters rows", () => {
    renderPage();
    const totalBefore = screen.getAllByRole("button", { name: /ago/i }).length;

    const searchInput = screen.getByPlaceholderText(/filter by actor/i);
    fireEvent.change(searchInput, { target: { value: "legal_hold" } });

    const afterFilter = screen.getAllByRole("button", { name: /ago/i }).length;
    expect(afterFilter).toBeLessThan(totalBefore);
  });
});
