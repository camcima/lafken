import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { AuditPage } from "./AuditPage";

vi.mock("@/features/audit/hooks/useAudit", () => ({
  useAuditEntries: () => ({
    data: { data: [], total: 0, page: 1, limit: 20, lastPage: 1 },
    isLoading: false,
  }),
}));

describe("AuditPage", () => {
  it("renders the empty state", () => {
    render(
      <I18nProvider>
        <AuditPage />
      </I18nProvider>,
    );
    expect(screen.getByText(/no audit entries match/i)).toBeInTheDocument();
  });

  it("renders the export button as disabled", () => {
    render(
      <I18nProvider>
        <AuditPage />
      </I18nProvider>,
    );
    const btn = screen.getByRole("button", { name: /export/i });
    expect(btn).toBeDisabled();
  });

  it("renders the filter inputs", () => {
    render(
      <I18nProvider>
        <AuditPage />
      </I18nProvider>,
    );
    expect(screen.getByText(/principal/i)).toBeInTheDocument();
    expect(screen.getByText(/^Action$/i)).toBeInTheDocument();
    expect(screen.getByText(/entity/i)).toBeInTheDocument();
  });
});
