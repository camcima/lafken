import type { LegalHoldResponseDTO, PaginatedResult } from "@shared/backend-api";
import type { AnyRouter, RouterHistory } from "@tanstack/react-router";
import { act, cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";

import { renderWithRouter } from "@/lib/test/render-with-router";
import { legalHoldsSearchSchema } from "@/routes/_protected/legal-holds.index";

import { LegalHoldsListPage } from "./LegalHoldsListPage";

// ── Sample data ─────────────────────────────────────────────────────────────

const ACTIVE_HOLD: LegalHoldResponseDTO = {
  id: "01900000-0000-7000-8000-000000000001",
  caseReference: "CHL-2026-AVN-014",
  description: "Investigation pending",
  scopeSummary: "namespace:fleet-photos",
  affectedAssetCount: 3,
  active: true,
  placedBy: "alice@example.com",
  placedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
};

const LIFTED_HOLD: LegalHoldResponseDTO = {
  id: "01900000-0000-7000-8000-000000000002",
  caseReference: "CHL-2025-AVN-099",
  description: "Closed",
  scopeSummary: "namespace:cargo-claims",
  affectedAssetCount: 1,
  active: false,
  placedBy: "bob@example.com",
  placedAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
  liftedAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
};

const PAGE: PaginatedResult<LegalHoldResponseDTO> = {
  data: [ACTIVE_HOLD, LIFTED_HOLD],
  total: 60,
  page: 1,
  limit: 25,
  lastPage: 3,
};

type LegalHoldsSearch = z.infer<typeof legalHoldsSearchSchema>;

// ── Mocks ───────────────────────────────────────────────────────────────────

interface IUseLegalHoldsResult {
  data: PaginatedResult<LegalHoldResponseDTO> | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

const useLegalHoldsMock = vi.fn<(query: Record<string, unknown>) => IUseLegalHoldsResult>();
vi.mock("@/features/legal-holds/hooks/useLegalHolds", () => ({
  useLegalHolds: (q: Record<string, unknown>) => useLegalHoldsMock(q),
  useLegalHold: () => ({ data: undefined, isLoading: false }),
}));

vi.mock("@/features/dashboard/hooks/useDashboardOverview", () => ({
  useDashboardOverview: () => ({
    data: {
      counts: {
        totalAssets: 0,
        inFlight: 0,
        queueDepth: 0,
        quarantine: 0,
        legalHolds: 7,
        assetsUnderLegalHold: 1234,
        failedProcessing: 0,
        namespaces: 0,
      },
      health: { overall: "ok", checks: [] },
    },
    isLoading: false,
  }),
}));

vi.mock("@/features/legal-holds/hooks/useLegalHoldMutations", () => ({
  useLiftLegalHold: () => ({ mutate: vi.fn(), isPending: false }),
}));

// ── Helper ──────────────────────────────────────────────────────────────────

function renderPage(initialUrl = "/legal-holds") {
  return renderWithRouter(
    {
      path: "legal-holds",
      index: true,
      component: LegalHoldsListPage,
      validateSearch: legalHoldsSearchSchema,
    },
    initialUrl,
  );
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  useLegalHoldsMock.mockReset();
  useLegalHoldsMock.mockReturnValue({
    data: PAGE,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe("LegalHoldsListPage", () => {
  it("renders the page title", async () => {
    await renderPage();
    expect(screen.getByRole("heading", { name: /legal holds/i })).toBeInTheDocument();
  });

  it("renders the case reference for the active hold", async () => {
    await renderPage();
    expect(screen.getByText("CHL-2026-AVN-014")).toBeInTheDocument();
  });

  it("renders stats cards", async () => {
    await renderPage();
    expect(screen.getByText(/active holds/i)).toBeInTheDocument();
    expect(screen.getByText(/assets under hold/i)).toBeInTheDocument();
  });

  it("filtering by status=active keeps the active row visible", async () => {
    const { router } = await renderPage();

    const statusSelect = await screen.findByRole("combobox", { name: /status/i });
    await userEvent.selectOptions(statusSelect, "active");

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ status: "active" });
    });
    expect(screen.getByText("CHL-2026-AVN-014")).toBeInTheDocument();
  });

  it("filtering by status=lifted hides active rows", async () => {
    const { router } = await renderPage();

    const statusSelect = await screen.findByRole("combobox", { name: /status/i });
    await userEvent.selectOptions(statusSelect, "lifted");

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ status: "lifted" });
    });
    expect(screen.queryByText("CHL-2026-AVN-014")).not.toBeInTheDocument();
  });

  it("renders Place hold link", async () => {
    await renderPage();
    expect(screen.getByRole("link", { name: /place hold/i })).toBeInTheDocument();
  });

  it("shows the server total of active holds in the stat tile, not the visible page count", async () => {
    await renderPage();
    // Dashboard reports 7 active holds; only 1 active hold is on the visible page.
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("shows the server total of assets under hold in the stat tile", async () => {
    await renderPage();
    expect(screen.getByText("1,234")).toBeInTheDocument();
  });

  it("derives pagination from the response lastPage so page 2+ is reachable", async () => {
    await renderPage();
    // 60 rows at 25/page => 3 pages; the paginator must render page button "3".
    expect(screen.getByRole("button", { name: /next page/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: "3" })).toBeInTheDocument();
  });

  // ── URL-as-truth (F-W2) ─────────────────────────────────────────────

  it("requests the server page from a deep link", async () => {
    await renderPage("/legal-holds?page=2");
    await waitFor(() => {
      expect(useLegalHoldsMock).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, limit: 25 }),
      );
    });
  });

  it("applies the status filter from a deep link", async () => {
    await renderPage("/legal-holds?status=lifted");
    // The lifted hold's case ref renders in the row — but it also
    // coincidentally matches the hardcoded "oldest hold" stat sub-text
    // (see en.json `pages.legalHolds.stats.oldestHold.sub`), so two
    // occurrences confirms the row itself rendered, not just the stat tile.
    await waitFor(() => {
      expect(screen.getAllByText(LIFTED_HOLD.caseReference)).toHaveLength(2);
    });
    expect(screen.queryByText(ACTIVE_HOLD.caseReference)).not.toBeInTheDocument();
  });

  it("writes the status filter to the URL and resets page", async () => {
    const { router } = await renderPage("/legal-holds?page=3");

    const statusSelect = await screen.findByRole("combobox", { name: /status/i });
    await userEvent.selectOptions(statusSelect, "active");

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ status: "active", page: 1 });
    });
  });

  it("resets page to 1 when the rows-per-page selector changes", async () => {
    const { router } = await renderPage("/legal-holds?page=3");

    const rowsPerPageSelect = await screen.findByRole("combobox", { name: /rows per page/i });
    await userEvent.selectOptions(rowsPerPageSelect, "100");

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ page: 1 });
    });
  });

  it("writes paginator page changes to the URL", async () => {
    const { router } = await renderPage();

    const nextButton = await screen.findByRole("button", { name: /next page/i });
    await userEvent.click(nextButton);

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ page: 2 });
    });
  });

  // The debounce is a real `setTimeout` (see SEARCH_DEBOUNCE_MS in
  // LegalHoldsListPage), so these tests drive it with fake timers instead of
  // a real ~250ms sleep — "tests are deterministic … no reliance on
  // wall-clock time" (CLAUDE.md). `userEvent` needs `advanceTimers` wired to
  // its own `setup()` instance so its internal per-keystroke waits resolve
  // against the mocked clock.
  describe("debounced search — deterministic timing", () => {
    const DEBOUNCE_MS = 250; // mirrors LegalHoldsListPage's SEARCH_DEBOUNCE_MS
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

    it("debounces the search box into the q search param", async () => {
      const { router } = await renderPage();

      const input = await screen.findByRole("textbox", { name: /search/i });
      await user.type(input, "CHL-2026");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
      });

      expect(router.state.location.search).toMatchObject({ q: "CHL-2026", page: 1 });
    });

    // Pushes a second history entry so a later `back()` has somewhere to go.
    // `as never` because the app-wide `Register` type merge (routeTree.gen.ts)
    // makes `navigate` reject any `to` outside the REAL route tree, and this
    // harness mounts a synthetic one — same escape hatch, and for the same
    // reason, as `render-with-router.tsx` documents.
    async function pushFilterEntry(router: AnyRouter): Promise<void> {
      await act(async () => {
        await router.navigate({
          to: "/legal-holds",
          search: { status: "active", page: 1 },
        } as never);
      });
    }

    it("keeps the URL where Back navigation left it instead of resurrecting the typed query", async () => {
      const { router } = await renderPage("/legal-holds");
      await pushFilterEntry(router);

      const input = await screen.findByRole("textbox", { name: /search/i });
      await user.type(input, "alice");
      await act(async () => {
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
      });
      expect(router.state.location.search).toMatchObject({ q: "alice" });

      act(() => {
        (router.history as RouterHistory).back();
      });

      // Let the debounce window fully elapse *after* Back. An effect that
      // re-arms whenever `q` changes (not only when the user types) would
      // silently rewrite q=alice here, undoing the Back navigation.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS * 2);
      });

      const search = router.state.location.search as LegalHoldsSearch;
      expect(search.q).toBeUndefined();
    });

    it("discards the in-flight edit when Back lands before the debounce fires", async () => {
      const { router } = await renderPage("/legal-holds");
      await pushFilterEntry(router);

      const input = await screen.findByRole("textbox", { name: /search/i });
      await user.type(input, "alice");

      // The other ordering: Back arrives while the write is still ARMED, so
      // the URL has not seen `q` at all yet. Guard that precondition — if the
      // debounce had already committed, this test would silently degenerate
      // into a duplicate of the one above.
      const beforeBack = router.state.location.search as LegalHoldsSearch;
      expect(beforeBack.q).toBeUndefined();

      act(() => {
        (router.history as RouterHistory).back();
      });

      // A timer armed by the last keystroke survives an external navigation
      // unless something cancels it: it fires with its stale closure value and
      // writes q=alice, undoing the Back the user just performed.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS * 4);
      });

      const search = router.state.location.search as LegalHoldsSearch;
      expect(search.q).toBeUndefined();
    });

    it("drops `q` from the URL entirely when the search box is cleared", async () => {
      const { router } = await renderPage("/legal-holds?q=alice");

      const input = await screen.findByRole("textbox", { name: /search/i });
      await user.clear(input);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
      });

      // `q` must be absent, not an empty string sitting in the URL as `?q=`.
      const search = router.state.location.search as LegalHoldsSearch;
      expect(search.q).toBeUndefined();
    });

    it("shows the URL's q in the search box after Back", async () => {
      const { router } = await renderPage("/legal-holds?q=alice");

      const input = await screen.findByRole("textbox", { name: /search/i });
      expect(input).toHaveValue("alice");

      await user.type(input, "bob");
      act(() => {
        (router.history as RouterHistory).back();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(DEBOUNCE_MS * 2);
      });

      // The uncommitted "bob" edit is discarded and the input falls back to
      // whatever the URL says — it does not keep displaying a value the URL
      // no longer holds.
      expect(await screen.findByRole("textbox", { name: /search/i })).toHaveValue("alice");
    });
  });

  // ── URL is Truth: malformed search params degrade gracefully ─────────

  it("falls back to page 1 without crashing when `page` is not a number", async () => {
    await renderPage("/legal-holds?page=abc");

    expect(await screen.findByRole("heading", { name: /legal holds/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(useLegalHoldsMock).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
    });
  });

  it("falls back to status=all without crashing when `status` is not a known value", async () => {
    await renderPage("/legal-holds?status=not-a-real-status");

    expect(await screen.findByRole("heading", { name: /legal holds/i })).toBeInTheDocument();
    // Unfiltered: both rows render. The lifted hold's case ref also matches
    // the hardcoded "oldest hold" stat sub-text (see en.json
    // `pages.legalHolds.stats.oldestHold.sub`), so it appears twice.
    expect(await screen.findByText(ACTIVE_HOLD.caseReference)).toBeInTheDocument();
    expect(screen.getAllByText(LIFTED_HOLD.caseReference)).toHaveLength(2);
  });
});
