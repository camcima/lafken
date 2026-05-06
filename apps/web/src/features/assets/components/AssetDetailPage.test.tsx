import type {
  AssetAnalysisResponseDTO,
  AssetResponseDTO,
  AssetStateTransitionResponseDTO,
  PaginatedResult,
} from "@shared/backend-api";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { AssetDetailPage } from "./AssetDetailPage";

const TEST_PUBLIC_ID = "01HXJ8K3QF7T2ZN9V6BQWPDXM4";

const TEST_ASSET: AssetResponseDTO = {
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

vi.mock("@/features/assets/hooks/useAssets", () => ({
  useAssets: () => ({ data: TEST_SIBLINGS, isLoading: false }),
  useAsset: () => ({ data: TEST_ASSET, isLoading: false, error: null }),
  useAssetStateTransitions: () => ({ data: TEST_TRANSITIONS, isLoading: false }),
  useAssetAnalyses: () => ({ data: TEST_ANALYSES, isLoading: false }),
  useAssetProcessingJob: () => ({ data: undefined, isLoading: false }),
}));

vi.mock("@lafken/react", () => ({
  AssetImage: () => null,
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

describe("AssetDetailPage", () => {
  it("renders the asset's public ID from BE data", () => {
    render(
      <I18nProvider>
        <AssetDetailPage publicId={TEST_PUBLIC_ID} />
      </I18nProvider>,
    );
    expect(screen.getByText(TEST_PUBLIC_ID)).toBeInTheDocument();
  });

  it("renders all major section titles", () => {
    render(
      <I18nProvider>
        <AssetDetailPage publicId={TEST_PUBLIC_ID} />
      </I18nProvider>,
    );

    expect(screen.getByText(/identity & lineage/i)).toBeInTheDocument();
    expect(screen.getByText(/file properties/i)).toBeInTheDocument();
    expect(screen.getByText(/timeline/i)).toBeInTheDocument();
    expect(screen.getByText(/analyses/i)).toBeInTheDocument();
    expect(screen.getByText(/custom metadata/i)).toBeInTheDocument();
    expect(screen.getByText(/capture context/i)).toBeInTheDocument();
    expect(screen.getByText(/available urls/i)).toBeInTheDocument();
  });

  it("renders the analyses returned by the BE", () => {
    render(
      <I18nProvider>
        <AssetDetailPage publicId={TEST_PUBLIC_ID} />
      </I18nProvider>,
    );

    expect(screen.getByText(/validator · 1\.0\.0/i)).toBeInTheDocument();
    expect(screen.getByText(/clamav · 1\.3\.1/i)).toBeInTheDocument();
  });
});
