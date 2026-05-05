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

// Force real-API mode for these tests.
vi.mock("@/lib/demo/demo-mode", () => ({ isDemoMode: false }));

// Mock the services module before importing the page so the page reads the
// mocked instances at import time.
const listAssetsMock =
  vi.fn<(query: Partial<ListAssetsQueryDTO>) => Promise<PaginatedResult<AssetResponseDTO>>>();
const listNamespacesMock =
  vi.fn<
    (query: { page?: number; limit?: number }) => Promise<PaginatedResult<NamespaceResponseDTO>>
  >();

vi.mock("@/services", () => ({
  assetsService: {
    list: (query: Partial<ListAssetsQueryDTO>) => listAssetsMock(query),
  },
  namespacesService: {
    list: (query: { page?: number; limit?: number }) => listNamespacesMock(query),
  },
}));

// TanStack Router Link mock — same pattern as the demo-mode test file.
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    to?: string;
    params?: Record<string, string>;
  }) => <a href={props.to ?? "#"}>{children}</a>,
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
  publicId: "abcdef12-3456-7890-abcd-ef1234567890",
  namespaceSlug: "fleet-photos",
  policyVersion: 1,
  state: "ready",
  customMetadata: {},
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
});

describe("AssetsListPage (real API)", () => {
  it("renders a row from the BE response", async () => {
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
    listNamespacesMock.mockResolvedValue({
      data: [NAMESPACE],
      total: 1,
      page: 1,
      limit: 100,
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
