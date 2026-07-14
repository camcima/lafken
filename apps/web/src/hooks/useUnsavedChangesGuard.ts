import { useBlocker } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

/**
 * Blocks navigation with a confirm dialog while `when` is true (F-W6).
 * This covers three exit paths:
 * - In-app PUSH/REPLACE navigation (`navigate()`, `<Link>`).
 * - The browser's physical Back/Forward buttons — `@tanstack/history`'s
 *   `createBrowserHistory` wires a native `popstate` listener that runs
 *   this same blocker for BACK/FORWARD/GO and reverts the URL when blocked.
 * - Tab close / reload, via the browser's native `beforeunload` prompt.
 *
 * Only navigations that leave the current route (a different `pathname`)
 * are blocked. Same-route navigations — e.g. writing a filter or page
 * number to the URL's search params — are let through untouched, so this
 * hook is safe to combine with pages that keep list state in the URL.
 *
 * RHF call sites should pass `isDirty && !isSubmitting && !isSubmitSuccessful`
 * so the success-path `navigate()` inside `onSubmit` is never blocked.
 */
export function useUnsavedChangesGuard(when: boolean): void {
  const { t } = useTranslation();

  useBlocker({
    shouldBlockFn: ({ current, next }) => {
      if (!when) return false;
      if (current.pathname === next.pathname) return false;
      return !window.confirm(t("common.unsavedChanges"));
    },
    enableBeforeUnload: () => when,
  });
}
