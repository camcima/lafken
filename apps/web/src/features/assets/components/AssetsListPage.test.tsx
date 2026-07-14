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

  it("renders view toggle buttons for Rows, Hybrid, and Grid", async () => {
    await renderPage();
    expect(await screen.findByRole("button", { name: /rows/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /hybrid/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /grid/i })).toBeInTheDocument();
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

  it("populates the namespace filter dropdown from the BE response", async () => {
    listAssetsMock.mockResolvedValue({ data: [], total: 0, page: 1, limit: 18, lastPage: 1 });

    await renderPage();

    await waitFor(() => {
      const nsSelect = screen.getByRole("combobox", { name: /namespace/i });
      const options = Array.from(nsSelect.querySelectorAll("option")).map((opt) => opt.value);
      expect(options).toContain("fleet-photos");
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

  it("resets page to 1 when the namespace filter changes", async () => {
    const { router } = await renderPage("/assets?page=3");

    const namespaceSelect = await screen.findByRole("combobox", { name: /namespace/i });
    await userEvent.selectOptions(namespaceSelect, "fleet-photos");

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({
        namespaceSlug: "fleet-photos",
        page: 1,
      });
    });
  });

  it("resets page to 1 when the rows-per-page selector changes", async () => {
    const { router } = await renderPage("/assets?page=3");

    const rowsPerPageSelect = await screen.findByRole("combobox", { name: /rows per page/i });
    await userEvent.selectOptions(rowsPerPageSelect, "50");

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ page: 1 });
    });
  });

  it("resets page to 1 when clearing filters", async () => {
    const { router } = await renderPage("/assets?page=3&state=ready");

    const clearButton = await screen.findByRole("button", { name: /clear filters/i });
    await userEvent.click(clearButton);

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ page: 1 });
    });
    expect(router.state.location.search).not.toHaveProperty("state");
  });

  it("writes page changes to the URL", async () => {
    const { router } = await renderPage("/assets");

    const nextButton = await screen.findByRole("button", { name: /next page/i });
    await userEvent.click(nextButton);

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ page: 2 });
    });
  });

  it("clears state and namespace filters but preserves the legal-hold scope", async () => {
    const holdId = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
    const { router } = await renderPage(
      `/assets?page=3&state=ready&namespaceSlug=fleet-photos&legalHoldId=${holdId}`,
    );

    const clearButton = await screen.findByRole("button", { name: /clear filters/i });
    await userEvent.click(clearButton);

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ legalHoldId: holdId, page: 1 });
    });
    expect(router.state.location.search).not.toHaveProperty("state");
    expect(router.state.location.search).not.toHaveProperty("namespaceSlug");
  });

  // ── URL is Truth: malformed search params degrade gracefully ─────────

  it("renders page 1 without crashing when `page` is not a number", async () => {
    await renderPage("/assets?page=abc");

    expect(await screen.findByRole("heading", { level: 1, name: /^Assets$/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(listAssetsMock).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
    });
  });

  it("renders unfiltered without crashing when `state` is not a known state", async () => {
    await renderPage("/assets?state=not-a-real-state");

    expect(await screen.findByRole("heading", { level: 1, name: /^Assets$/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(listAssetsMock).toHaveBeenCalledWith(expect.objectContaining({ states: undefined }));
    });
  });

  it("renders unscoped without crashing when `legalHoldId` is not a uuid", async () => {
    await renderPage("/assets?legalHoldId=not-a-uuid");

    expect(await screen.findByRole("heading", { level: 1, name: /^Assets$/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(listAssetsMock).toHaveBeenCalledWith(
        expect.objectContaining({ legalHoldId: undefined }),
      );
    });
  });

  // ── Error state with retry (F-W4) ─────────────────────────────────────

  it("shows the error state with a retry button when the list query fails", async () => {
    listAssetsMock.mockRejectedValue(new Error("boom"));

    await renderPage();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText(/no assets match these filters/i)).not.toBeInTheDocument();
  });

  it("re-fetches on retry and replaces the error with data once the retry succeeds", async () => {
    listAssetsMock.mockRejectedValueOnce(new Error("boom"));

    await renderPage();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(listAssetsMock).toHaveBeenCalledTimes(1);

    listAssetsMock.mockResolvedValueOnce({
      data: [ASSET],
      total: 100,
      page: 1,
      limit: 18,
      lastPage: 6,
    });
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => {
      expect(listAssetsMock).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
    expect(screen.getByText(/abcdef12/)).toBeInTheDocument();
  });
});
