import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { QuarantinePage } from "./QuarantinePage";

vi.mock("@/features/quarantine/hooks/useQuarantine", () => ({
  useQuarantine: () => ({
    data: { data: [], total: 0, page: 1, limit: 20, lastPage: 1 },
    isLoading: false,
  }),
}));

describe("QuarantinePage", () => {
  it("renders the empty state", () => {
    render(
      <I18nProvider>
        <QuarantinePage />
      </I18nProvider>,
    );
    expect(screen.getByText(/nothing to review right now/i)).toBeInTheDocument();
  });

  it("renders the flagged assets description", () => {
    render(
      <I18nProvider>
        <QuarantinePage />
      </I18nProvider>,
    );
    expect(screen.getByText(/flagged assets will appear here/i)).toBeInTheDocument();
  });
});
