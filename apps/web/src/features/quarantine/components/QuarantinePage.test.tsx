import type { PaginatedResult, QuarantinedAssetResponseDTO } from "@shared/backend-api";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithRouter } from "@/lib/test/render-with-router";
import { quarantineSearchSchema } from "@/routes/_protected/quarantine";

import { QuarantinePage } from "./QuarantinePage";

function renderPage(initialUrl = "/quarantine") {
  return renderWithRouter(
    {
      path: "quarantine",
      index: false,
      component: QuarantinePage,
      validateSearch: quarantineSearchSchema,
    },
    initialUrl,
  );
}

function makeAsset(overrides: Partial<QuarantinedAssetResponseDTO>): QuarantinedAssetResponseDTO {
  const now = new Date();
  return {
    id: overrides.id ?? "01900000-0000-7000-8000-000000000040",
    publicId: overrides.publicId ?? "11111111-1111-1111-1111-111111111111",
    namespaceSlug: overrides.namespaceSlug ?? "fleet-photos",
    policyVersion: 1,
    state: overrides.state ?? "quarantined_invalid_format",
    sizeBytes: 1024,
    declaredMimeType: "image/jpeg",
    width: 64,
    height: 48,
    uploadedBy: "user@example.com",
    customMetadata: {},
    tags: [],
    legalHold: false,
    stateChangedAt: now.toISOString(),
    createdAt: now.toISOString(),
    quarantineKind: overrides.quarantineKind ?? "invalid_format",
    flaggedAt: now.toISOString(),
    stateReason: overrides.stateReason,
    ...overrides,
  };
}

const INVALID_FORMAT_ASSET: QuarantinedAssetResponseDTO = makeAsset({
  publicId: "aaaaaaaa-1111-1111-1111-111111111111",
  quarantineKind: "invalid_format",
  state: "quarantined_invalid_format",
  stateReason: "declared image/jpeg, sniffed image/png",
});

const MODERATION_ASSET: QuarantinedAssetResponseDTO = makeAsset({
  publicId: "bbbbbbbb-2222-2222-2222-222222222222",
  quarantineKind: "moderation",
  state: "quarantined_moderation",
  flaggedAnalyzer: "moderation-v2",
  flaggedCategory: "violence",
});

const VIRUS_ASSET: QuarantinedAssetResponseDTO = makeAsset({
  publicId: "cccccccc-3333-3333-3333-333333333333",
  quarantineKind: "virus",
  state: "quarantined_virus",
  flaggedAnalyzer: "clamav",
  flaggedCategory: "EICAR-Test",
});

const ASSETS: QuarantinedAssetResponseDTO[] = [INVALID_FORMAT_ASSET, MODERATION_ASSET, VIRUS_ASSET];

interface IUseQuarantineResult {
  data: PaginatedResult<QuarantinedAssetResponseDTO> | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

const useQuarantineMock = vi.fn<(query: Record<string, unknown>) => IUseQuarantineResult>();
vi.mock("@/features/quarantine/hooks/useQuarantine", () => ({
  useQuarantine: (q: Record<string, unknown>) => useQuarantineMock(q),
}));

vi.mock("@/features/quarantine/hooks/useQuarantineMutations", () => ({
  useReleaseQuarantinedAsset: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRejectQuarantinedAsset: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  useQuarantineMock.mockReset();
  useQuarantineMock.mockReturnValue({
    data: { data: ASSETS, total: ASSETS.length, page: 1, limit: 20, lastPage: 1 },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
});

describe("QuarantinePage", () => {
  it("renders the title heading", async () => {
    await renderPage();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/quarantine queue/i);
  });

  it("renders one queue button per quarantined asset", async () => {
    await renderPage();
    // Each queue row uses the publicId prefix as its label; the page also has
    // filter buttons + actions, so we filter to queue rows by aria-current.
    expect(screen.getByText(/aaaaaaaa…/)).toBeInTheDocument();
    expect(screen.getByText(/bbbbbbbb…/)).toBeInTheDocument();
    expect(screen.getByText(/cccccccc…/)).toBeInTheDocument();
  });

  it("renders the filter toggle buttons", async () => {
    await renderPage();
    expect(screen.getByRole("button", { name: /^all/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^moderation/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^virus/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^invalid format/i })).toBeInTheDocument();
  });

  it("filters to invalid_format items when that tab is clicked", async () => {
    await renderPage();
    const invalidBtn = screen.getByRole("button", { name: /^invalid format/i });
    await userEvent.click(invalidBtn);
    // Moderation and virus rows disappear, invalid_format row remains.
    expect(await screen.findByText(/aaaaaaaa…/)).toBeInTheDocument();
    expect(screen.queryByText(/bbbbbbbb…/)).not.toBeInTheDocument();
    expect(screen.queryByText(/cccccccc…/)).not.toBeInTheDocument();
  });

  it("shows the invalid_format verdict block on the detail pane when selected", async () => {
    await renderPage();
    // First asset is auto-selected; the verdict text should be visible.
    expect(await screen.findByText(/magic-byte mismatch/i)).toBeInTheDocument();
    // The state_reason renders both in the queue row AND in the detail pane.
    expect(screen.getAllByText(/declared image\/jpeg, sniffed image\/png/i).length).toBeGreaterThan(
      0,
    );
  });

  it("opens the reject modal when Reject is clicked", async () => {
    await renderPage();
    const rejectBtn = await screen.findByRole("button", { name: /reject…/i });
    await userEvent.click(rejectBtn);
    expect(screen.getByPlaceholderText(/confirms moderation flag/i)).toBeInTheDocument();
  });

  it("disables the reject-confirm button while the note is too short", async () => {
    await renderPage();
    await userEvent.click(await screen.findByRole("button", { name: /reject…/i }));
    const dialog = screen.getByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: /reject asset/i });
    expect(confirm).toBeDisabled();
  });

  it("renders an Open detail link for the selected asset", async () => {
    await renderPage();
    // Button asChild + Link renders the trailing CTA as an anchor.
    const openDetailEl = await screen.findByText(/open detail/i);
    expect(openDetailEl.closest("a")).toBeInTheDocument();
  });

  // ── URL-as-truth (F-W2) ─────────────────────────────────────────────

  it("applies the kind filter from a deep link", async () => {
    await renderPage("/quarantine?kind=virus");

    // Only virus rows render in the queue list. Assert via the publicId
    // prefixes the queue renders (first 8 chars + ellipsis) — the "…" suffix
    // keeps the match scoped to the truncated queue row rather than also
    // matching the untruncated publicId in the (auto-selected) detail pane.
    expect(
      await screen.findByText(new RegExp(`${VIRUS_ASSET.publicId.slice(0, 8)}…`)),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(new RegExp(`${MODERATION_ASSET.publicId.slice(0, 8)}…`)),
    ).not.toBeInTheDocument();
  });

  it("writes the kind filter to the URL when a tab is clicked", async () => {
    const { router } = await renderPage();

    await userEvent.click(await screen.findByRole("button", { name: /virus/i }));

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ kind: "virus" });
    });
  });

  // ── URL is Truth: malformed search params degrade gracefully ─────────

  it("falls back to the all filter without crashing when `kind` is not a known kind", async () => {
    await renderPage("/quarantine?kind=not-a-real-kind");

    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(/quarantine queue/i);
    // All three fixture rows render — the malformed value degraded to "all".
    expect(screen.getByText(/aaaaaaaa…/)).toBeInTheDocument();
    expect(screen.getByText(/bbbbbbbb…/)).toBeInTheDocument();
    expect(screen.getByText(/cccccccc…/)).toBeInTheDocument();
  });

  // ── Error state with retry (F-W4) ─────────────────────────────────────

  it("shows the error state with a retry button when the list query fails", async () => {
    useQuarantineMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    });

    await renderPage();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText(/aaaaaaaa…/)).not.toBeInTheDocument();
    expect(screen.queryByText(/all clear/i)).not.toBeInTheDocument();
  });

  it("calls the query's refetch when the retry button is clicked", async () => {
    const refetch = vi.fn();
    useQuarantineMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    });

    await renderPage();

    await userEvent.click(await screen.findByRole("button", { name: /retry/i }));

    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
