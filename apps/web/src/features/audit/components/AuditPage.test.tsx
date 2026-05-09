import type { AuditEntryResponseDTO, PaginatedResult } from "@shared/backend-api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { AuditPage } from "./AuditPage";

const ENTRIES: AuditEntryResponseDTO[] = [
  {
    id: "01900000-0000-7000-8000-000000000001",
    entityType: "asset",
    entityId: "01900000-0000-7000-8000-000000000aaa",
    action: "uploaded",
    occurredAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    occurredBy: "alice@example.com",
    requestIp: "10.0.0.1",
  },
  {
    id: "01900000-0000-7000-8000-000000000002",
    entityType: "legal_hold",
    entityId: "01900000-0000-7000-8000-000000000bbb",
    action: "placed",
    occurredAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    occurredBy: "bob@example.com",
    requestIp: "10.0.0.2",
  },
];

const PAGE: PaginatedResult<AuditEntryResponseDTO> = {
  data: ENTRIES,
  total: 2,
  page: 1,
  limit: 50,
  lastPage: 1,
};

vi.mock("@/features/audit/hooks/useAudit", () => ({
  useAuditEntries: () => ({ data: PAGE, isLoading: false }),
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

  it("renders rows from the audit feed", () => {
    renderPage();
    expect(screen.getByText("asset.uploaded")).toBeInTheDocument();
    expect(screen.getByText("legal_hold.placed")).toBeInTheDocument();
  });

  it("renders ok result badges", () => {
    renderPage();
    expect(screen.getAllByText("ok").length).toBeGreaterThan(0);
  });
});
