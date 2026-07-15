import type {
  AssetAnalysisResponseDTO,
  AssetResponseDTO,
  AssetStateTransitionResponseDTO,
  PaginatedResult,
} from "@shared/backend-api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { AssetDetailPage } from "./AssetDetailPage";

const TEST_PUBLIC_ID = "01HXJ8K3QF7T2ZN9V6BQWPDXM4";

const TEST_ASSET: AssetResponseDTO = {
  id: "01900000-0000-7000-8000-000000000040",
  publicId: TEST_PUBLIC_ID,
  namespaceSlug: "aircraft-photos",
  policyVersion: 7,
  state: "ready",
  sizeBytes: 4_287_614,
  mimeType: "image/jpeg",
  declaredMimeType: "image/jpeg",
  width: 4032,
  height: 3024,
  contentHashHex: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  uploadedBy: "user:m.fernandez@latam.com",
  externalRefType: "work_order",
  externalRefId: "wo-2026-04-29-N12345-018",
  customMetadata: { aircraft_tail: "N12345", inspection_type: "pre-flight" },
  captureContext: {
    captured_at: "2026-05-03T08:11:48Z",
    device: { make: "Apple", model: "iPhone 15 Pro", os: "iOS 17.4" },
  },
  tags: [],
  legalHold: false,
  confirmedAt: "2026-05-03T08:14:22Z",
  stateChangedAt: "2026-05-03T08:14:33Z",
  createdAt: "2026-05-03T08:14:00Z",
};

const TEST_TRANSITIONS: AssetStateTransitionResponseDTO[] = [
  {
    fromState: "uploaded",
    toState: "processing",
    reason: "pipeline started",
    occurredBy: "worker:processor-7",
    occurredAt: "2026-05-03T08:14:23Z",
  },
  {
    fromState: "processing",
    toState: "ready",
    reason: "pipeline complete",
    occurredBy: "worker:processor-7",
    occurredAt: "2026-05-03T08:14:33Z",
  },
];

const TEST_ANALYSES: AssetAnalysisResponseDTO[] = [
  {
    analyzer: "validator",
    analyzerVersion: "1.0.0",
    findings: { ok: true, summary: "policy v7 ok" },
    decision: "pass",
    occurredAt: "2026-05-03T08:14:24Z",
  },
  {
    analyzer: "clamav",
    analyzerVersion: "1.3.1",
    findings: { infected: false },
    decision: "pass",
    occurredAt: "2026-05-03T08:14:27Z",
  },
];

const TEST_SIBLINGS: PaginatedResult<AssetResponseDTO> = {
  data: [TEST_ASSET],
  total: 1,
  page: 1,
  limit: 20,
  lastPage: 1,
};

let mockAsset: AssetResponseDTO = TEST_ASSET;

function withState(state: AssetResponseDTO["state"]): AssetResponseDTO {
  return Object.assign(Object.create(null) as object, TEST_ASSET, { state }) as AssetResponseDTO;
}

vi.mock("@/features/assets/hooks/useAssets", () => ({
  useAssets: () => ({ data: TEST_SIBLINGS, isLoading: false }),
  useAsset: () => ({ data: mockAsset, isLoading: false, error: null }),
  useAssetStateTransitions: () => ({ data: TEST_TRANSITIONS, isLoading: false }),
  useAssetAnalyses: () => ({ data: TEST_ANALYSES, isLoading: false }),
  useAssetProcessingJob: () => ({ data: undefined, isLoading: false }),
}));

vi.mock("@/features/namespaces/hooks/useNamespaces", () => ({
  useNamespacePresets: () => ({ data: [], isLoading: false }),
}));

const mockGetDownloadUrl = vi
  .fn()
  .mockResolvedValue({ url: "https://storage.example.com/blob.jpg?sig=x" });
const mockRetryProcessing = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/lafken-client", () => ({
  getLafkenClient: () => ({
    assets: {
      getDownloadUrl: mockGetDownloadUrl,
      retryProcessing: mockRetryProcessing,
    },
  }),
}));

const mockDeleteAsset = vi.fn().mockResolvedValue(undefined);

vi.mock("@lafken/react", () => ({
  AssetImage: () => null,
  useAssetPresetUrl: () => ({
    url: "https://cdn.example.com/preview.webp",
    isLoading: false,
    error: null,
  }),
  useLafkenClient: () => ({ assets: { delete: mockDeleteAsset } }),
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

function renderPage(): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AssetDetailPage id={TEST_ASSET.id} />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe("AssetDetailPage", () => {
  beforeEach(() => {
    mockAsset = TEST_ASSET;
    mockGetDownloadUrl.mockClear();
    mockRetryProcessing.mockClear();
    mockDeleteAsset.mockClear();
  });

  it("renders the asset's public ID from BE data", () => {
    renderPage();
    expect(screen.getByText(TEST_PUBLIC_ID)).toBeInTheDocument();
  });

  it("renders all major section titles", () => {
    renderPage();

    expect(screen.getByText(/identity & lineage/i)).toBeInTheDocument();
    expect(screen.getByText(/file properties/i)).toBeInTheDocument();
    expect(screen.getByText(/timeline/i)).toBeInTheDocument();
    expect(screen.getByText(/analyses/i)).toBeInTheDocument();
    expect(screen.getByText(/custom metadata/i)).toBeInTheDocument();
    expect(screen.getByText(/capture context/i)).toBeInTheDocument();
    expect(screen.getByText(/available urls/i)).toBeInTheDocument();
  });

  it("renders the analyses returned by the BE", () => {
    renderPage();

    expect(screen.getByText(/validator · 1\.0\.0/i)).toBeInTheDocument();
    expect(screen.getByText(/clamav · 1\.3\.1/i)).toBeInTheDocument();
  });

  it("does not render the retry-processing button when the asset is in 'ready'", () => {
    mockAsset = withState("ready");
    renderPage();
    expect(screen.queryByRole("button", { name: /retry processing/i })).not.toBeInTheDocument();
  });

  it("renders the retry-processing button when the asset is in 'processing_failed'", () => {
    mockAsset = withState("processing_failed");
    renderPage();
    expect(screen.getByRole("button", { name: /retry processing/i })).toBeInTheDocument();
  });

  it("calls the SDK retryProcessing with the asset's internal id when the retry button is clicked", async () => {
    mockAsset = withState("processing_failed");
    renderPage();
    const button = screen.getByRole("button", { name: /retry processing/i });
    await userEvent.click(button);
    expect(mockRetryProcessing).toHaveBeenCalledTimes(1);
    expect(mockRetryProcessing).toHaveBeenCalledWith(TEST_ASSET.id);
  });

  it("renders system preset rows in the PresetsCard", () => {
    renderPage();
    expect(screen.getByText("lafken:thumbnail")).toBeInTheDocument();
    expect(screen.getByText("lafken:detail-hero")).toBeInTheDocument();
  });

  it("opens the delete dialog and calls assets.delete with the internal id on confirm", async () => {
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(mockDeleteAsset).toHaveBeenCalledWith(TEST_ASSET.id);
    });
  });

  it("shows an error message in the dialog when the delete fails", async () => {
    mockDeleteAsset.mockRejectedValueOnce(new Error("409"));
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: /^delete$/i }),
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("does not render the delete button for an already-deleted asset", () => {
    mockAsset = withState("deleted");
    renderPage();
    expect(screen.queryByRole("button", { name: /^delete$/i })).not.toBeInTheDocument();
  });
});
