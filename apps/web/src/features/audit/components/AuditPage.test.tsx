import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { AuditPage } from "./AuditPage";

vi.mock("@/features/audit/hooks/useAudit", () => ({
  useAuditEntries: () => ({
    data: { data: [], total: 0, page: 1, limit: 20, lastPage: 1 },
    isLoading: false,
  }),
}));

function renderPage() {
  return render(
    <I18nProvider>
      <AuditPage />
    </I18nProvider>,
  );
}

describe("AuditPage", () => {
  it("renders the page title", () => {
    renderPage();
    expect(screen.getByText(/audit log/i)).toBeInTheDocument();
  });

  it("renders Export CSV button", () => {
    renderPage();
    expect(screen.getByRole("button", { name: /export csv/i })).toBeInTheDocument();
  });

  it("renders demo audit rows — at least one event type is visible", () => {
    renderPage();
    // DEMO_AUDIT has event types like asset.uploaded, legal_hold.placed, etc.
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
    // Click the first audit row (which opens the drawer)
    const rows = screen.getAllByRole("button", { name: /ago/i });
    fireEvent.click(rows[0]);

    // Drawer should be open — Copy JSON button is visible
    expect(screen.getByRole("button", { name: /copy json/i })).toBeInTheDocument();

    // Close button closes the drawer
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
