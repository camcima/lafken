import type { AuditEntryResponseDTO, PaginatedResult } from "@shared/backend-api";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithRouter } from "@/lib/test/render-with-router";
import { auditSearchSchema } from "@/routes/_protected/audit";

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

interface IUseAuditEntriesResult {
  data: PaginatedResult<AuditEntryResponseDTO> | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

const useAuditEntriesMock = vi.fn<(query: Record<string, unknown>) => IUseAuditEntriesResult>();
vi.mock("@/features/audit/hooks/useAudit", () => ({
  useAuditEntries: (q: Record<string, unknown>) => useAuditEntriesMock(q),
}));

function renderPage(initialUrl = "/audit") {
  return renderWithRouter(
    { path: "audit", index: false, component: AuditPage, validateSearch: auditSearchSchema },
    initialUrl,
  );
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  useAuditEntriesMock.mockReset();
  useAuditEntriesMock.mockReturnValue({
    data: PAGE,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
});

describe("AuditPage", () => {
  it("renders the page title", async () => {
    await renderPage();
    expect(screen.getByText(/audit log/i)).toBeInTheDocument();
  });

  it("renders rows from the audit feed", async () => {
    await renderPage();
    expect(screen.getByText("asset.uploaded")).toBeInTheDocument();
    expect(screen.getByText("legal_hold.placed")).toBeInTheDocument();
  });

  it("renders ok result badges", async () => {
    await renderPage();
    expect(screen.getAllByText("ok").length).toBeGreaterThan(0);
  });

  // ── URL-as-truth (F-W2) ─────────────────────────────────────────────

  it("queries the BE with entityType, q, and page from a deep link", async () => {
    await renderPage("/audit?type=legal_hold&q=alice&page=2");

    await waitFor(() => {
      expect(useAuditEntriesMock).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, entityType: "legal_hold", q: "alice" }),
      );
    });
  });

  it("writes the type filter to the URL and resets page", async () => {
    const { router } = await renderPage("/audit?page=4");

    const typeSelect = await screen.findByRole("combobox", { name: /event type/i });
    await userEvent.selectOptions(typeSelect, "legal_hold");

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ type: "legal_hold", page: 1 });
    });
  });

  it("debounces the search input into the q search param", async () => {
    const { router } = await renderPage("/audit");

    const input = await screen.findByRole("textbox", { name: /search/i });
    await userEvent.type(input, "carlos");

    await waitFor(
      () => {
        expect(router.state.location.search).toMatchObject({ q: "carlos", page: 1 });
      },
      { timeout: 2000 },
    );
  });

  it("resets page to 1 when the rows-per-page selector changes", async () => {
    const { router } = await renderPage("/audit?page=3");

    const rowsPerPageSelect = await screen.findByRole("combobox", { name: /rows per page/i });
    await userEvent.selectOptions(rowsPerPageSelect, "100");

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ page: 1 });
    });
  });

  it("writes paginator page changes to the URL", async () => {
    useAuditEntriesMock.mockReturnValue({
      data: { ...PAGE, total: 200 },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    const { router } = await renderPage("/audit");

    const nextButton = await screen.findByRole("button", { name: /next page/i });
    await userEvent.click(nextButton);

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ page: 2 });
    });
  });

  // ── URL is Truth: malformed search params degrade gracefully ─────────

  it("falls back to page 1 without crashing when `page` is not a number", async () => {
    await renderPage("/audit?page=abc");

    expect(await screen.findByText(/audit log/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(useAuditEntriesMock).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
    });
  });

  it("renders unfiltered without crashing when `type` is not a known entity type", async () => {
    await renderPage("/audit?type=not-a-real-type");

    expect(await screen.findByText(/audit log/i)).toBeInTheDocument();
    await waitFor(() => {
      const lastCall = useAuditEntriesMock.mock.calls.at(-1)?.[0];
      expect(lastCall?.entityType).toBeUndefined();
    });
  });
});
