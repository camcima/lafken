import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { AssetsListPage } from "./AssetsListPage";

vi.mock("@/features/assets/hooks/useAssets", () => ({
  useAssets: () => ({
    data: { data: [], total: 0, page: 1, limit: 20, lastPage: 1 },
    isLoading: false,
  }),
}));

describe("AssetsListPage", () => {
  it("renders the empty state and column headers", () => {
    render(
      <I18nProvider>
        <AssetsListPage />
      </I18nProvider>,
    );
    expect(screen.getByText(/no assets match these filters/i)).toBeInTheDocument();
    expect(screen.getByText(/^Asset$/i)).toBeInTheDocument();
  });

  it("renders the pagination footer with zero counts", () => {
    render(
      <I18nProvider>
        <AssetsListPage />
      </I18nProvider>,
    );
    expect(screen.getByText(/0 of 0 · page 1/i)).toBeInTheDocument();
  });

  it("renders all table column headers", () => {
    render(
      <I18nProvider>
        <AssetsListPage />
      </I18nProvider>,
    );
    // Use getAllByText for labels that appear in both the filter rail and the table header
    expect(screen.getByRole("columnheader", { name: /^Asset$/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /^Namespace$/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /^State$/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /^Size$/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /^Uploaded$/i })).toBeInTheDocument();
  });

  it("renders the bulk actions button as disabled", () => {
    render(
      <I18nProvider>
        <AssetsListPage />
      </I18nProvider>,
    );
    const btn = screen.getByRole("button", { name: /bulk actions/i });
    expect(btn).toBeDisabled();
  });
});
