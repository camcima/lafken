import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { AssetsListPage } from "./AssetsListPage";

// Pin demo mode on so the page renders the demo client-side flow. The
// real-API path is exercised in AssetsListPage.real-api.test.tsx.
vi.mock("@/lib/demo/demo-mode", () => ({ isDemoMode: true }));

// AssetImage requires a LafkenProvider; stub it out in unit tests.
vi.mock("@lafken/react", () => ({
  AssetImage: () => null,
}));

// TanStack Router Link + useSearch mock
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    to?: string;
    params?: Record<string, string>;
  }) => <a href={props.to ?? "#"}>{children}</a>,
  useSearch: () => ({ legalHoldId: undefined }),
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nProvider>
      <QueryClientProvider client={client}>
        <AssetsListPage />
      </QueryClientProvider>
    </I18nProvider>,
  );
}

afterEach(() => {
  cleanup();
});

describe("AssetsListPage", () => {
  it("renders without crashing (smoke test)", () => {
    const { container } = renderPage();
    expect(container).toBeInTheDocument();
  });

  it('renders the header title "Assets"', () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: /^Assets$/i })).toBeInTheDocument();
  });

  it("renders the search input", () => {
    renderPage();
    expect(
      screen.getByRole("searchbox", {
        name: /search by public id/i,
      }),
    ).toBeInTheDocument();
  });

  it("renders the state filter select", () => {
    renderPage();
    expect(screen.getByRole("combobox", { name: /state/i })).toBeInTheDocument();
  });

  it("renders the namespace filter select", () => {
    renderPage();
    expect(screen.getByRole("combobox", { name: /namespace/i })).toBeInTheDocument();
  });

  it("renders view toggle buttons for Rows, Hybrid, and Grid", () => {
    renderPage();
    expect(screen.getByRole("button", { name: /rows/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /hybrid/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /grid/i })).toBeInTheDocument();
  });

  it("default view (rows) renders column headers", () => {
    renderPage();
    expect(screen.getByText(/^Asset$/i)).toBeInTheDocument();
    expect(screen.getByText(/^namespace$/i)).toBeInTheDocument();
    expect(screen.getByText(/format · dimensions/i)).toBeInTheDocument();
  });

  it("default view (rows) renders demo asset rows", () => {
    renderPage();
    // There are 312 demo assets, page size 18 — at least 1 row visible
    const links = screen.getAllByRole("link");
    // Multiple links expected (rows)
    expect(links.length).toBeGreaterThan(0);
  });

  it("setting state filter to processing_failed narrows the list", async () => {
    const user = userEvent.setup();
    renderPage();
    const stateSelect = screen.getByRole("combobox", { name: /state/i });

    // Capture initial summary
    const initialSummary = screen.getByText(/showing/i);
    const initialText = initialSummary.textContent ?? "";

    await user.selectOptions(stateSelect, "processing_failed");

    const updatedSummary = screen.getByText(/showing/i);
    const updatedText = updatedSummary.textContent ?? "";

    // The count should be lower than the full list
    expect(updatedText).not.toEqual(initialText);
  });

  it("shows empty state when filters yield no matches", async () => {
    const user = userEvent.setup();
    renderPage();
    const searchInput = screen.getByRole("searchbox", { name: /search by public id/i });
    await user.type(searchInput, "zzzzzz_nomatch_ever");
    expect(screen.getByText(/no assets match these filters/i)).toBeInTheDocument();
  });

  it("shows summary line with range", () => {
    renderPage();
    expect(screen.getByText(/showing/i)).toBeInTheDocument();
  });

  it("shows Paginator navigation when there are multiple pages", () => {
    renderPage();
    // 312 assets, 18 per page = 18 pages — Paginator renders
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });

  it("switching to grid view changes the display", async () => {
    const user = userEvent.setup();
    renderPage();
    const gridBtn = screen.getByRole("button", { name: /grid/i });
    await user.click(gridBtn);
    expect(gridBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("switching to hybrid view changes the display", async () => {
    const user = userEvent.setup();
    renderPage();
    const hybridBtn = screen.getByRole("button", { name: /hybrid/i });
    await user.click(hybridBtn);
    expect(hybridBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("renders quick filter pills", () => {
    renderPage();
    expect(screen.getByRole("button", { name: /last 24h/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /has legal hold/i })).toBeInTheDocument();
  });

  it("shows bulk action bar when rows are selected", async () => {
    const user = userEvent.setup();
    renderPage();
    const checkboxes = screen.getAllByRole("checkbox");
    // First checkbox is the "check all"; click the second one (first data row)
    // We know there's at least one data row because DEMO_ASSET_LIST has 312 items
    const firstRowCheckbox = checkboxes[1];
    await user.click(firstRowCheckbox);
    expect(screen.getByText(/\d+ selected/i)).toBeInTheDocument();
    // The bulk bar renders a "Place legal hold" button that only appears when items are selected
    expect(screen.getByRole("button", { name: /place legal hold/i })).toBeInTheDocument();
  });

  it("clears bulk selection when Clear button in bulk bar is clicked", async () => {
    const user = userEvent.setup();
    renderPage();
    const checkboxes = screen.getAllByRole("checkbox");
    // We know there's at least one data row because DEMO_ASSET_LIST has 312 items
    const firstRowCheckbox = checkboxes[1];
    await user.click(firstRowCheckbox);
    // Find the "Clear" button in the bulk action bar
    const bulkBar = screen.getByText(/selected/i).closest("div") as HTMLElement;
    const clearBtn = within(bulkBar).getByRole("button", { name: /clear/i });
    await user.click(clearBtn);
    expect(screen.queryByText(/1 selected/i)).not.toBeInTheDocument();
  });
});
