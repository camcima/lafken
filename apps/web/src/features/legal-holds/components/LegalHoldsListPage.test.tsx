import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { LegalHoldsListPage } from "./LegalHoldsListPage";

vi.mock("@/features/legal-holds/hooks/useLegalHolds", () => ({
  useLegalHolds: () => ({
    data: { data: [], total: 0, page: 1, limit: 20, lastPage: 1 },
    isLoading: false,
  }),
  useLegalHold: () => ({ data: undefined, isLoading: false }),
}));

describe("LegalHoldsListPage", () => {
  it("renders the empty state", () => {
    render(
      <I18nProvider>
        <LegalHoldsListPage />
      </I18nProvider>,
    );
    expect(screen.getByText(/no active legal holds/i)).toBeInTheDocument();
  });

  it("renders the place hold button as disabled", () => {
    render(
      <I18nProvider>
        <LegalHoldsListPage />
      </I18nProvider>,
    );
    const btn = screen.getByRole("button", { name: /place hold/i });
    expect(btn).toBeDisabled();
  });
});
