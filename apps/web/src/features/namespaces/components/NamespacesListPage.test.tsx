import type { NamespaceResponseDTO } from "@shared/backend-api";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { NamespacesListPage } from "./NamespacesListPage";

// ── Shared mock state ──────────────────────────────────────
let mockNamespaces: NamespaceResponseDTO[] = [];
let mockTotal = 0;

vi.mock("@/features/namespaces/hooks/useNamespaces", () => ({
  useNamespaces: () => ({
    data: { data: mockNamespaces, total: mockTotal, page: 1, limit: 50, lastPage: 1 },
    isLoading: false,
  }),
  useNamespace: () => ({ data: undefined, isLoading: false }),
  useNamespacePolicies: () => ({ data: undefined, isLoading: false }),
  useNamespacePresets: () => ({ data: undefined, isLoading: false }),
}));

vi.mock("@tanstack/react-router", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
  return {
    ...actual,
    Link: ({
      children,
      to,
      params,
      ...props
    }: {
      children: ReactNode;
      to: string;
      params?: Record<string, string>;
      [k: string]: unknown;
    }) => {
      const resolvedHref = params
        ? Object.entries(params).reduce((href, [key, val]) => href.replace(`$${key}`, val), to)
        : to;
      return (
        <a href={resolvedHref} {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
          {children}
        </a>
      );
    },
    useNavigate: () => vi.fn(),
  };
});

const SAMPLE_NAMESPACE: NamespaceResponseDTO = {
  slug: "aircraft-photos",
  displayName: "Aircraft Photos",
  currentPolicyVersion: 7,
  storageBindingName: "gcs-prod-aircraft",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const SAMPLE_NAMESPACE_2: NamespaceResponseDTO = {
  slug: "cargo-damage",
  displayName: "Cargo Damage Reports",
  currentPolicyVersion: 4,
  storageBindingName: "gcs-prod-cargo",
  archivedAt: "2026-03-01T00:00:00.000Z",
  createdAt: "2026-01-15T00:00:00.000Z",
  updatedAt: "2026-03-01T00:00:00.000Z",
};

function renderPage() {
  return render(
    <I18nProvider>
      <NamespacesListPage />
    </I18nProvider>,
  );
}

describe("NamespacesListPage — header", () => {
  it("renders the title heading", () => {
    mockNamespaces = [];
    mockTotal = 0;
    renderPage();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/namespaces/i);
  });

  it("renders the + New namespace link pointing to /namespaces/new", () => {
    mockNamespaces = [SAMPLE_NAMESPACE];
    mockTotal = 1;
    renderPage();
    const link = screen.getByRole("link", { name: /new namespace/i });
    expect(link).toHaveAttribute("href", "/namespaces/new");
  });

  it("does not show (demo) watermark", () => {
    mockNamespaces = [SAMPLE_NAMESPACE];
    mockTotal = 1;
    renderPage();
    expect(screen.queryByText("(demo)")).not.toBeInTheDocument();
  });
});

describe("NamespacesListPage — card grid", () => {
  it("renders one card per namespace with displayName as a heading", () => {
    mockNamespaces = [SAMPLE_NAMESPACE, SAMPLE_NAMESPACE_2];
    mockTotal = 2;
    renderPage();
    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings).toHaveLength(2);
    expect(headings[0]).toHaveTextContent("Aircraft Photos");
    expect(headings[1]).toHaveTextContent("Cargo Damage Reports");
  });

  it("renders the slug below the display name", () => {
    mockNamespaces = [SAMPLE_NAMESPACE];
    mockTotal = 1;
    renderPage();
    expect(screen.getByText("aircraft-photos")).toBeInTheDocument();
  });

  it("renders the policy version badge in the card header", () => {
    mockNamespaces = [SAMPLE_NAMESPACE];
    mockTotal = 1;
    renderPage();
    // Header badge + bottom info strip both render the policy version label.
    const matches = screen.getAllByText(/policy v7/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("renders the storage binding name in the bottom info strip", () => {
    mockNamespaces = [SAMPLE_NAMESPACE];
    mockTotal = 1;
    renderPage();
    expect(screen.getByText(/gcs-prod-aircraft/)).toBeInTheDocument();
  });

  it("shows the archived badge when archivedAt is set", () => {
    mockNamespaces = [SAMPLE_NAMESPACE_2];
    mockTotal = 1;
    renderPage();
    expect(screen.getByText("archived")).toBeInTheDocument();
  });

  it("does not show the archived badge for active namespaces", () => {
    mockNamespaces = [SAMPLE_NAMESPACE];
    mockTotal = 1;
    renderPage();
    expect(screen.queryByText("archived")).not.toBeInTheDocument();
  });

  it("links each card to /namespaces/:slug", () => {
    mockNamespaces = [SAMPLE_NAMESPACE];
    mockTotal = 1;
    renderPage();
    const link = screen.getByRole("link", { name: /aircraft photos/i });
    expect(link).toHaveAttribute("href", "/namespaces/aircraft-photos");
  });

  it("filters namespaces by search query", async () => {
    mockNamespaces = [SAMPLE_NAMESPACE, SAMPLE_NAMESPACE_2];
    mockTotal = 2;
    renderPage();
    const searchInput = screen.getByRole("searchbox");
    await userEvent.type(searchInput, "aircraft");
    expect(screen.getByText("Aircraft Photos")).toBeInTheDocument();
    expect(screen.queryByText("Cargo Damage Reports")).not.toBeInTheDocument();
  });
});

describe("NamespacesListPage — empty states", () => {
  it("renders the no-namespaces empty state with a CTA when the list is empty", () => {
    mockNamespaces = [];
    mockTotal = 0;
    renderPage();
    expect(screen.getByText(/no namespaces yet/i)).toBeInTheDocument();
    // CTA link in the empty state and the header CTA — both point to /namespaces/new.
    const links = screen.getAllByRole("link", { name: /new namespace/i });
    expect(links.length).toBeGreaterThanOrEqual(2);
    for (const link of links) {
      expect(link).toHaveAttribute("href", "/namespaces/new");
    }
  });

  it("renders a no-match empty state (without CTA) when filters return nothing", async () => {
    mockNamespaces = [SAMPLE_NAMESPACE];
    mockTotal = 1;
    renderPage();
    const searchInput = screen.getByRole("searchbox");
    await userEvent.type(searchInput, "zzzznoresults");
    expect(screen.getByText(/no namespaces match/i)).toBeInTheDocument();
    // Only the header CTA remains — no second CTA in the no-match state.
    const links = screen.getAllByRole("link", { name: /new namespace/i });
    expect(links).toHaveLength(1);
  });
});
