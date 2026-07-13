import type {
  AssetResponseDTO,
  ListAssetsQueryDTO,
  NamespaceResponseDTO,
  PaginatedResult,
} from "@shared/backend-api";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithRouter } from "@/lib/test/render-with-router";
import { assetsSearchSchema } from "@/routes/_protected/assets/index";

import { AssetsListPage } from "./AssetsListPage";

// Mock the SDK client used by useAssets / useNamespaces (network boundary).
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

function renderPage(initialUrl = "/assets") {
  return renderWithRouter(
    {
      path: "assets",
      index: true,
      component: AssetsListPage,
      validateSearch: assetsSearchSchema,
    },
    initialUrl,
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
    total: 100,
    page: 1,
    limit: 18,
    lastPage: 6,
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
  it("renders the header title", async () => {
    await renderPage();
    expect(await screen.findByRole("heading", { level: 1, name: /^Assets$/i })).toBeInTheDocument();
  });

  it("renders the search input", async () => {
    await renderPage();
    expect(
      await screen.findByRole("searchbox", { name: /search by public id/i }),
    ).toBeInTheDocument();
  });

  it("renders the state filter and namespace filter selects", async () => {
    await renderPage();
    expect(await screen.findByRole("combobox", { name: /state/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /namespace/i })).toBeInTheDocument();
  });

  it("renders a row from the BE response", async () => {
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText(/abcdef12/)).toBeInTheDocument();
    });
  });

  it("renders the empty card when the BE returns no assets", async () => {
    listAssetsMock.mockResolvedValue({ data: [], total: 0, page: 1, limit: 18, lastPage: 1 });
    listNamespacesMock.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 100,
      lastPage: 1,
    });

    await renderPage();

    await waitFor(() => {
      expect(screen.getByText(/no assets match these filters/i)).toBeInTheDocument();
    });
  });

  // ── URL-as-truth (F-W2) ─────────────────────────────────────────────

  it("queries the BE with page and state from a deep link", async () => {
    await renderPage("/assets?page=3&state=ready");

    await waitFor(() => {
      expect(listAssetsMock).toHaveBeenCalledWith(
        expect.objectContaining({ page: 3, states: ["ready"] }),
      );
    });
  });

  it("writes the state filter to the URL and resets page", async () => {
    const { router } = await renderPage("/assets?page=3");

    const stateSelect = await screen.findByRole("combobox", { name: /state/i });
    await userEvent.selectOptions(stateSelect, "processing");

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ state: "processing", page: 1 });
    });
    await waitFor(() => {
      expect(listAssetsMock).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, states: ["processing"] }),
      );
    });
  });

  it("writes page changes to the URL", async () => {
    const { router } = await renderPage("/assets");

    const nextButton = await screen.findByRole("button", { name: /next page/i });
    await userEvent.click(nextButton);

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ page: 2 });
    });
  });
});
