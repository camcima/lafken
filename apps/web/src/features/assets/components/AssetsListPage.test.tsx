import type {
  AssetResponseDTO,
  ListAssetsQueryDTO,
  NamespaceResponseDTO,
  PaginatedResult,
} from "@shared/backend-api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { AssetsListPage } from "./AssetsListPage";

// Mock the SDK client used by useAssets / useNamespaces.
const listAssetsMock =
  vi.fn<(query: Partial<ListAssetsQueryDTO>) => Promise<PaginatedResult<AssetResponseDTO>>>();
const listNamespacesMock =
  vi.fn<
    (query: { page?: number; limit?: number }) => Promise<PaginatedResult<NamespaceResponseDTO>>
  >();

vi.mock("@lafken/react", () => ({
  AssetImage: () => null,
  useLafkenClient: () => ({
    assets: { list: (q: Partial<ListAssetsQueryDTO>) => listAssetsMock(q) },
    namespaces: {
      list: (q: { page?: number; limit?: number }) => listNamespacesMock(q),
    },
  }),
}));

// TanStack Router Link + useSearch mock
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    to?: string;
    params?: Record<string, string>;
  }) => <a href={props.to ?? "#"}>{children}</a>,
  useSearch: () => ({ legalHoldId: undefined, namespaceSlug: undefined }),
  useNavigate: () => () => {},
}));

function renderPage(): ReturnType<typeof render> {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nProvider>
      <QueryClientProvider client={client}>
        <AssetsListPage />
      </QueryClientProvider>
    </I18nProvider>,
  );
}

const ASSET: AssetResponseDTO = {
  id: "01900000-0000-7000-8000-000000000040",
  publicId: "abcdef12-3456-7890-abcd-ef1234567890",
  namespaceSlug: "fleet-photos",
  policyVersion: 1,
  state: "ready",
  customMetadata: {},
  tags: [],
  legalHold: false,
  stateChangedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  mimeType: "image/jpeg",
};

const NAMESPACE: NamespaceResponseDTO = {
  slug: "fleet-photos",
  displayName: "Fleet Photos",
  description: undefined,
  currentPolicyVersion: 1,
  storageBindingName: "gcs-prod",
  archivedAt: undefined,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  listAssetsMock.mockReset();
  listNamespacesMock.mockReset();
  listAssetsMock.mockResolvedValue({
    data: [ASSET],
    total: 1,
    page: 1,
    limit: 18,
    lastPage: 1,
  });
  listNamespacesMock.mockResolvedValue({
    data: [NAMESPACE],
    total: 1,
    page: 1,
    limit: 100,
    lastPage: 1,
  });
});

describe("AssetsListPage", () => {
  it("renders the header title", () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: /^Assets$/i })).toBeInTheDocument();
  });

  it("renders the search input", () => {
    renderPage();
    expect(screen.getByRole("searchbox", { name: /search by public id/i })).toBeInTheDocument();
  });

  it("renders the state filter and namespace filter selects", () => {
    renderPage();
    expect(screen.getByRole("combobox", { name: /state/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /namespace/i })).toBeInTheDocument();
  });

  it("renders view toggle buttons for Rows, Hybrid, and Grid", () => {
    renderPage();
    expect(screen.getByRole("button", { name: /rows/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /hybrid/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /grid/i })).toBeInTheDocument();
  });

  it("renders quick filter pills", () => {
    renderPage();
    expect(screen.getByRole("button", { name: /last 24h/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /has legal hold/i })).toBeInTheDocument();
  });

  it("renders a row from the BE response", async () => {
    renderPage();
    await waitFor(() => {
      // shortId is the first 8 chars of publicId
      expect(screen.getByText(/abcdef12/)).toBeInTheDocument();
    });
  });

  it("renders the empty card when the BE returns no assets", async () => {
    listAssetsMock.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 18,
      lastPage: 1,
    });
    listNamespacesMock.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 100,
      lastPage: 1,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/no assets match these filters/i)).toBeInTheDocument();
    });
  });

  it("populates the namespace filter dropdown from the BE response", async () => {
    listAssetsMock.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 18,
      lastPage: 1,
    });

    renderPage();

    await waitFor(() => {
      const nsSelect = screen.getByRole("combobox", { name: /namespace/i });
      const options = Array.from(nsSelect.querySelectorAll("option")).map((opt) => opt.value);
      expect(options).toContain("fleet-photos");
    });
  });
});
