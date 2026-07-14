import type { AuditEntryResponseDTO, PaginatedResult } from "@shared/backend-api";
import type { RouterHistory } from "@tanstack/react-router";
import { act, cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";

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

type AuditSearch = z.infer<typeof auditSearchSchema>;

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

  // The debounce is a real `setTimeout` (see SEARCH_DEBOUNCE_MS in AuditPage),
  // so these tests drive it with fake timers instead of a real ~250ms sleep —
  // "tests are deterministic … no reliance on wall-clock time" (CLAUDE.md).
  // `userEvent` needs `advanceTimers` wired to its own `setup()` instance so
  // its internal per-keystroke waits resolve against the mocked clock.
  describe("debounced search — deterministic timing", () => {
    const DEBOUNCE_MS = 250; // mirrors AuditPage's SEARCH_DEBOUNCE_MS
    let user: ReturnType<typeof userEvent.setup>;

    beforeEach(() => {
      // `shouldAdvanceTime` lets the mocked clock tick forward on its own so
      // React's scheduler and userEvent's own internal waits keep resolving;
      // the 250ms debounce itself is still driven deterministically below via
      // explicit `advanceTimersByTimeAsync` jumps, not by waiting on it.
      vi.useFakeTimers({ shouldAdvanceTime: true });
      user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("debounces the search input into the q search param", async () => {
      const { router } = await renderPage("/audit");

      const input = await screen.findByRole("textbox", { name: /search/i });
      await user.type(input, "carlos");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
      });

      expect(router.state.location.search).toMatchObject({ q: "carlos", page: 1 });
    });

    it("keeps the URL where Back navigation left it instead of resurrecting the typed query", async () => {
      const { router } = await renderPage("/audit");

      // Push a second history entry first — mirrors the reviewer's repro:
      // the user changes a filter (a normal push) before typing a search.
      await act(async () => {
        await router.navigate({
          to: "/audit",
          search: { type: "legal_hold", page: 1 },
        } as never);
      });

      const input = await screen.findByRole("textbox", { name: /search/i });
      await user.type(input, "alice");
      await act(async () => {
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
      });
      expect(router.state.location.search).toMatchObject({ q: "alice" });

      act(() => {
        (router.history as RouterHistory).back();
      });

      // Let the debounce window fully elapse *after* Back. A buggy effect
      // that re-arms whenever `q` changes (not only when the user types)
      // would silently rewrite q=alice here, undoing the Back navigation.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS * 2);
      });

      const search = router.state.location.search as AuditSearch;
      expect(search.q).toBeUndefined();
    });
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
