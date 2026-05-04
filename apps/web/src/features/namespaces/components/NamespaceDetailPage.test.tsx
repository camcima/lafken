import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    useNavigate: () => vi.fn(),
    useSearch: () => ({ tab: "overview" }),
  };
});

describe("NamespaceDetailPage — not found", () => {
  it("renders the not-found empty state when slug has no demo match", () => {
    render(
      <I18nProvider>
        <NamespaceDetailPage slug="no-such-namespace" />
      </I18nProvider>,
    );
    expect(screen.getByText(/namespace not found/i)).toBeInTheDocument();
  });

  it("renders the back-to-namespaces action link", () => {
    render(
      <I18nProvider>
        <NamespaceDetailPage slug="no-such-namespace" />
      </I18nProvider>,
    );
    expect(screen.getByText(/back to namespaces/i)).toBeInTheDocument();
  });
});

describe("NamespaceDetailPage — valid slug", () => {
  it("renders the namespace display name", () => {
    render(
      <I18nProvider>
        <NamespaceDetailPage slug="aircraft-photos" />
      </I18nProvider>,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Aircraft Photos");
  });

  it("renders all 6 tabs", () => {
    render(
      <I18nProvider>
        <NamespaceDetailPage slug="aircraft-photos" />
      </I18nProvider>,
    );
    const tabList = screen.getByRole("tablist");
    const tabs = tabList.querySelectorAll("[role='tab']");
    expect(tabs).toHaveLength(6);
  });

  it("renders overview tab content by default", () => {
    render(
      <I18nProvider>
        <NamespaceDetailPage slug="aircraft-photos" />
      </I18nProvider>,
    );
    expect(screen.getByText(/latest activity/i)).toBeInTheDocument();
  });

  it("switches to policy tab when clicked", async () => {
    const onTabChange = vi.fn();
    render(
      <I18nProvider>
        <NamespaceDetailPage slug="aircraft-photos" tab="overview" onTabChange={onTabChange} />
      </I18nProvider>,
    );
    const policyTab = screen.getByRole("tab", { name: /policy/i });
    await userEvent.click(policyTab);
    expect(onTabChange).toHaveBeenCalledWith("policy");
  });
});
