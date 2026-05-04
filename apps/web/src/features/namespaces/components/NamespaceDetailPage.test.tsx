import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import * as useNamespacesModule from "@/features/namespaces/hooks/useNamespaces";
import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { NamespaceDetailPage } from "./NamespaceDetailPage";

// Default mock — namespace not found in API (uses demo data, not archived)
vi.mock("@/features/namespaces/hooks/useNamespaces", () => ({
  useNamespaces: () => ({
    data: { data: [], total: 0, page: 1, limit: 20, lastPage: 1 },
    isLoading: false,
  }),
  useNamespace: () => ({ data: undefined, isLoading: false, error: new Error("Not found") }),
  useNamespacePolicies: () => ({ data: undefined, isLoading: false }),
  useNamespacePresets: () => ({ data: undefined, isLoading: false }),
  useUpdateNamespaceMetadata: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useArchiveNamespace: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUnarchiveNamespace: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateNamespace: () => ({ mutateAsync: vi.fn(), isPending: false }),
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

function renderPage(props: {
  slug: string;
  tab?: "overview" | "policy" | "presets" | "assets" | "webhooks" | "quotas";
  onTabChange?: () => void;
}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <I18nProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </I18nProvider>
    );
  }
  return render(
    <Wrapper>
      <NamespaceDetailPage slug={props.slug} tab={props.tab} onTabChange={props.onTabChange} />
    </Wrapper>,
  );
}

describe("NamespaceDetailPage — not found", () => {
  it("renders the not-found empty state when slug has no demo match", () => {
    renderPage({ slug: "no-such-namespace" });
    expect(screen.getByText(/namespace not found/i)).toBeInTheDocument();
  });

  it("renders the back-to-namespaces action link", () => {
    renderPage({ slug: "no-such-namespace" });
    expect(screen.getByText(/back to namespaces/i)).toBeInTheDocument();
  });
});

describe("NamespaceDetailPage — valid slug", () => {
  it("renders the namespace display name", () => {
    renderPage({ slug: "aircraft-photos" });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Aircraft Photos");
  });

  it("renders all 6 tabs", () => {
    renderPage({ slug: "aircraft-photos" });
    const tabList = screen.getByRole("tablist");
    const tabs = tabList.querySelectorAll("[role='tab']");
    expect(tabs).toHaveLength(6);
  });

  it("renders overview tab content by default", () => {
    renderPage({ slug: "aircraft-photos" });
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

  it("renders Edit metadata button on active namespace", () => {
    renderPage({ slug: "aircraft-photos" });
    expect(screen.getByRole("button", { name: /edit metadata/i })).toBeInTheDocument();
  });

  it("renders Edit policy button as disabled with deferred tooltip", () => {
    renderPage({ slug: "aircraft-photos" });
    const editPolicyBtn = screen.getByRole("button", { name: /edit policy/i });
    expect(editPolicyBtn).toBeDisabled();
    expect(editPolicyBtn).toHaveAttribute("aria-disabled", "true");
    expect(editPolicyBtn).toHaveAttribute("title");
    expect(editPolicyBtn.getAttribute("title")).toMatch(/policy editing/i);
  });

  it("renders Archive button on active namespace and opens dialog with archive mode on click", async () => {
    const user = userEvent.setup();
    renderPage({ slug: "aircraft-photos" });

    const archiveBtn = screen.getByRole("button", { name: /^archive$/i });
    expect(archiveBtn).toBeInTheDocument();

    await user.click(archiveBtn);

    // Dialog should open with archive copy
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveTextContent(/archive aircraft photos\?/i);
  });
});

describe("NamespaceDetailPage — archived namespace", () => {
  it("renders Unarchive button and archived badge when namespace is archived", () => {
    // Temporarily override useNamespace to return an archived namespace
    const spy = vi.spyOn(useNamespacesModule, "useNamespace").mockReturnValue({
      data: {
        slug: "aircraft-photos",
        displayName: "Aircraft Photos",
        description: undefined,
        currentPolicyVersion: 7,
        storageBindingName: "gcs-prod",
        archivedAt: "2026-02-01T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-02-01T00:00:00.000Z",
      },
      isLoading: false,
    } as ReturnType<typeof useNamespacesModule.useNamespace>);

    renderPage({ slug: "aircraft-photos" });

    expect(screen.getByRole("button", { name: /^unarchive$/i })).toBeInTheDocument();
    expect(screen.getByText(/archived/i)).toBeInTheDocument();

    spy.mockRestore();
  });
});
