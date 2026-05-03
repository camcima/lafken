import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { NamespaceDetailPage } from "./NamespaceDetailPage";

vi.mock("@/features/namespaces/hooks/useNamespaces", () => ({
  useNamespaces: () => ({
    data: { data: [], total: 0, page: 1, limit: 20, lastPage: 1 },
    isLoading: false,
  }),
  useNamespace: () => ({ data: undefined, isLoading: false, error: new Error("Not found") }),
  useNamespacePolicies: () => ({ data: undefined, isLoading: false }),
  useNamespacePresets: () => ({ data: undefined, isLoading: false }),
}));

vi.mock("@tanstack/react-router", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
  return {
    ...actual,
    Link: ({ children, ...props }: { children: React.ReactNode; [k: string]: unknown }) => (
      <a {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>{children}</a>
    ),
  };
});

describe("NamespaceDetailPage", () => {
  it("renders the not-found empty state when namespace is undefined", () => {
    render(
      <I18nProvider>
        <NamespaceDetailPage slug="test-slug" />
      </I18nProvider>,
    );
    expect(screen.getByText(/namespace not found/i)).toBeInTheDocument();
  });

  it("renders the back-to-namespaces action link", () => {
    render(
      <I18nProvider>
        <NamespaceDetailPage slug="test-slug" />
      </I18nProvider>,
    );
    expect(screen.getByText(/back to namespaces/i)).toBeInTheDocument();
  });
});
