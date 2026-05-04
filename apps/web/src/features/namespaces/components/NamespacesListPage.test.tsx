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

describe("NamespacesListPage — demo fallback (empty API response)", () => {
  it("renders the title heading", () => {
    mockNamespaces = [];
    mockTotal = 0;
    renderPage();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/namespaces/i);
  });

  it("renders at least 3 demo namespace cards", () => {
    mockNamespaces = [];
    mockTotal = 0;
    renderPage();
    const cards = screen.getAllByRole("heading", { level: 2 });
    expect(cards.length).toBeGreaterThanOrEqual(3);
  });

  it("renders all 6 demo namespaces by default", () => {
    mockNamespaces = [];
    mockTotal = 0;
    renderPage();
    expect(screen.getByText("Aircraft Photos")).toBeInTheDocument();
    expect(screen.getByText("Cargo Damage Reports")).toBeInTheDocument();
    expect(screen.getByText("Engine Borescope")).toBeInTheDocument();
  });

  it("shows (demo) watermark in the page header", () => {
    mockNamespaces = [];
    mockTotal = 0;
    renderPage();
    expect(screen.getByText("(demo)")).toBeInTheDocument();
  });

  it("filters demo namespaces by search query", async () => {
    mockNamespaces = [];
    mockTotal = 0;
    renderPage();
    const searchInput = screen.getByRole("searchbox");
    await userEvent.type(searchInput, "aircraft");
    expect(screen.getByText("Aircraft Photos")).toBeInTheDocument();
    expect(screen.queryByText("Cargo Damage Reports")).not.toBeInTheDocument();
  });

  it("opens the detail drawer when a demo namespace card is clicked", async () => {
    mockNamespaces = [];
    mockTotal = 0;
    renderPage();
    // getAllByRole("button")[0] is the "+ New namespace" button inside the Link.
    // Namespace card buttons start at index 1.
    const firstCard = screen.getAllByRole("button")[1];
    await userEvent.click(firstCard);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("NamespacesListPage — real data path", () => {
  it("renders real namespace rows when API returns data", () => {
    mockNamespaces = [SAMPLE_NAMESPACE, SAMPLE_NAMESPACE_2];
    mockTotal = 2;
    renderPage();
    expect(screen.getByText("aircraft-photos")).toBeInTheDocument();
    expect(screen.getByText("Aircraft Photos")).toBeInTheDocument();
    expect(screen.getByText("cargo-damage")).toBeInTheDocument();
  });

  it("does not show demo-only fields (assetCount, retention, maxBytes) in real mode", () => {
    mockNamespaces = [SAMPLE_NAMESPACE];
    mockTotal = 1;
    renderPage();
    // Demo headings (h2) should not appear
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
    // Demo-specific stat labels should not appear
    expect(screen.queryByText(/assets/i)).not.toBeInTheDocument();
  });

  it("shows archived badge for namespaces with archivedAt set", () => {
    mockNamespaces = [SAMPLE_NAMESPACE_2];
    mockTotal = 1;
    renderPage();
    expect(screen.getByText("archived")).toBeInTheDocument();
  });

  it("does not show archived badge for active namespaces", () => {
    mockNamespaces = [SAMPLE_NAMESPACE];
    mockTotal = 1;
    renderPage();
    expect(screen.queryByText("archived")).not.toBeInTheDocument();
  });

  it("does not show (demo) watermark when real data is present", () => {
    mockNamespaces = [SAMPLE_NAMESPACE];
    mockTotal = 1;
    renderPage();
    expect(screen.queryByText("(demo)")).not.toBeInTheDocument();
  });

  it("links each real row to /namespaces/:slug", () => {
    mockNamespaces = [SAMPLE_NAMESPACE];
    mockTotal = 1;
    renderPage();
    const link = screen.getByRole("link", { name: /aircraft-photos/i });
    expect(link).toHaveAttribute("href", "/namespaces/aircraft-photos");
  });

  it("filters real namespaces by search query", async () => {
    mockNamespaces = [SAMPLE_NAMESPACE, SAMPLE_NAMESPACE_2];
    mockTotal = 2;
    renderPage();
    const searchInput = screen.getByRole("searchbox");
    await userEvent.type(searchInput, "aircraft");
    expect(screen.getByText("aircraft-photos")).toBeInTheDocument();
    expect(screen.queryByText("cargo-damage")).not.toBeInTheDocument();
  });
});

describe("NamespacesListPage — + New namespace link", () => {
  it("renders the + New namespace link pointing to /namespaces/new", () => {
    mockNamespaces = [];
    mockTotal = 0;
    renderPage();
    const link = screen.getByRole("link", { name: /new namespace/i });
    expect(link).toHaveAttribute("href", "/namespaces/new");
  });

  it("renders the + New namespace link in real-data mode too", () => {
    mockNamespaces = [SAMPLE_NAMESPACE];
    mockTotal = 1;
    renderPage();
    const link = screen.getByRole("link", { name: /new namespace/i });
    expect(link).toHaveAttribute("href", "/namespaces/new");
  });
});
