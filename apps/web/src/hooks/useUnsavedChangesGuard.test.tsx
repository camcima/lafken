import {
  createBrowserHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { I18nProvider } from "@/lib/i18n/i18n-test-provider";
import { renderWithRouter } from "@/lib/test/render-with-router";

import { useUnsavedChangesGuard } from "./useUnsavedChangesGuard";

// `/guarded` and `/elsewhere` are synthetic ids that exist only inside this
// test's harness-built route tree, not in the app's real `routeTree.gen.ts`.
// The app-wide `Register` type merge makes `navigate({ to })` reject any
// path outside the REAL route set at compile time, so those literals are
// cast to bypass that check (see render-with-router.test.tsx for the same
// pattern).
function GuardedPage({ when = true }: { when?: boolean }) {
  useUnsavedChangesGuard(when);
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => {
        void navigate({ to: "/elsewhere" } as never);
      }}
    >
      leave
    </button>
  );
}

const searchSchema = z.object({ q: z.string().optional() });

function GuardedSearchPage() {
  useUnsavedChangesGuard(true);
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => {
        void navigate({
          to: "/guarded",
          search: (prev: { q?: string }) => ({ ...prev, q: "typed" }),
        } as never);
      }}
    >
      filter
    </button>
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useUnsavedChangesGuard", () => {
  it("blocks navigation when the user cancels the confirm dialog", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const { router } = await renderWithRouter(
      { path: "guarded", index: false, component: GuardedPage },
      "/guarded",
    );

    await userEvent.click(await screen.findByRole("button", { name: "leave" }));

    // Still on the guarded page.
    expect(router.state.location.pathname).toBe("/guarded");
    expect(window.confirm).toHaveBeenCalledTimes(1);
  });

  it("allows navigation when the user confirms", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { router } = await renderWithRouter(
      { path: "guarded", index: false, component: GuardedPage },
      "/guarded",
    );

    await userEvent.click(await screen.findByRole("button", { name: "leave" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/elsewhere");
    });
  });

  it("does not prompt and navigates freely when the form is pristine", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    const { router } = await renderWithRouter(
      { path: "guarded", index: false, component: () => <GuardedPage when={false} /> },
      "/guarded",
    );

    await userEvent.click(await screen.findByRole("button", { name: "leave" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/elsewhere");
    });
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  // This is the exact shape of the classic bug: a page keeps list/filter
  // state in the URL (F-W2). A same-route search-param update (typing in a
  // filter box, changing a page number) must never trip the "leave this
  // page?" prompt, even while the guard is armed.
  it("does not prompt for a same-route search-param update while armed", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    const { router } = await renderWithRouter(
      {
        path: "guarded",
        index: false,
        component: GuardedSearchPage,
        validateSearch: searchSchema,
      },
      "/guarded",
    );

    await userEvent.click(await screen.findByRole("button", { name: "filter" }));

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ q: "typed" });
    });
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  describe("beforeunload", () => {
    // `renderWithRouter` uses `createMemoryHistory`, which never wires the
    // browser's native `beforeunload` handler — only `createBrowserHistory`
    // does (see @tanstack/history). This suite builds its own minimal
    // router with `createBrowserHistory` so the `enableBeforeUnload` wiring
    // is exercised for real instead of merely asserting the option was
    // passed.
    function renderWithBrowserHistory(when: boolean) {
      const rootRoute = createRootRoute({ component: () => <GuardedPage when={when} /> });
      const router = createRouter({ routeTree: rootRoute, history: createBrowserHistory() });
      render(
        <I18nProvider>
          <RouterProvider router={router as never} />
        </I18nProvider>,
      );
      return router;
    }

    it("arms the beforeunload prompt while dirty", async () => {
      renderWithBrowserHistory(true);
      await screen.findByRole("button", { name: "leave" });

      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
    });

    it("does not arm the beforeunload prompt when pristine", async () => {
      renderWithBrowserHistory(false);
      await screen.findByRole("button", { name: "leave" });

      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(false);
    });
  });

  // The implementer's report claimed the guard does NOT intercept the
  // browser's physical Back/Forward buttons — only in-app PUSH/REPLACE and
  // `beforeunload`. That claim is false: `@tanstack/history`'s
  // `createBrowserHistory` wires a native `popstate` listener
  // (`onPushPopEvent`) that runs registered blockers for BACK/FORWARD/GO
  // too, and reverts (`window.history.go(1)`) when blocked. This suite
  // proves it for real by pressing Back on the SAME `createBrowserHistory`
  // harness the `beforeunload` suite above builds — `createMemoryHistory`
  // (used by `renderWithRouter`) never fires `popstate`, so it cannot
  // exercise this path.
  describe("physical Back/Forward button", () => {
    // Two real routes (not the single rootRoute the `beforeunload` suite
    // uses) so there is a distinct prior entry for the browser to land on
    // when Back is pressed.
    function renderNavigableBrowserHistory(when: boolean) {
      const rootRoute = createRootRoute({ component: Outlet });
      const homeRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: "/",
        component: () => <div>home</div>,
      });
      const guardedRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: "/guarded",
        component: () => <GuardedPage when={when} />,
      });
      const routeTree = rootRoute.addChildren([homeRoute, guardedRoute]);
      const router = createRouter({ routeTree, history: createBrowserHistory() });
      render(
        <I18nProvider>
          <RouterProvider router={router as never} />
        </I18nProvider>,
      );
      return router;
    }

    beforeEach(() => {
      // jsdom's `window` persists across tests in this file (only React
      // unmounts via `cleanup()`), so without resetting the REAL location
      // here, a test would inherit wherever the previous test's back
      // navigation left `window.location`.
      window.history.replaceState(null, "", "/");
      // Plain `vi.useFakeTimers()` hangs TanStack Router's Transitioner;
      // `shouldAdvanceTime: true` lets its internal scheduling keep
      // resolving while we still control time deterministically below.
      // Needed here because jsdom's `history.back()`/`go()` queue their
      // popstate dispatch through nested `setTimeout(0)` tasks (see
      // jsdom's SessionHistory#traverseByDelta) rather than firing
      // synchronously.
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    async function goToGuardedPage(router: ReturnType<typeof renderNavigableBrowserHistory>) {
      await act(async () => {
        await router.navigate({ to: "/guarded" } as never);
      });
      await screen.findByRole("button", { name: "leave" });
    }

    async function pressPhysicalBackButton() {
      await act(async () => {
        // This is exactly what a physical Back-button press invokes —
        // NOT `router.history.back()`, which would go through TanStack's
        // in-app BACK handling instead of the native popstate path.
        window.history.back();
        await vi.runAllTimersAsync();
      });
    }

    it("blocks Back and keeps the URL in place when dirty and the user cancels", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(false);
      const router = renderNavigableBrowserHistory(true);
      await goToGuardedPage(router);

      await pressPhysicalBackButton();

      expect(window.confirm).toHaveBeenCalledTimes(1);
      expect(router.state.location.pathname).toBe("/guarded");
      expect(window.location.pathname).toBe("/guarded");
    });

    it("proceeds with Back when dirty and the user confirms discarding changes", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(true);
      const router = renderNavigableBrowserHistory(true);
      await goToGuardedPage(router);

      await pressPhysicalBackButton();

      expect(window.confirm).toHaveBeenCalledTimes(1);
      expect(router.state.location.pathname).toBe("/");
      expect(window.location.pathname).toBe("/");
    });

    it("proceeds with Back and never prompts when the form is pristine", async () => {
      const confirmSpy = vi.spyOn(window, "confirm");
      const router = renderNavigableBrowserHistory(false);
      await goToGuardedPage(router);

      await pressPhysicalBackButton();

      expect(confirmSpy).not.toHaveBeenCalled();
      expect(router.state.location.pathname).toBe("/");
    });
  });
});
