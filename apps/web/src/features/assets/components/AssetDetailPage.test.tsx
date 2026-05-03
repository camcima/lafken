import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { AssetDetailPage } from "./AssetDetailPage";

// Slice 0: the page always renders the canonical demo asset regardless of publicId
vi.mock("@/features/assets/hooks/useAssets", () => ({
  useAssets: () => ({
    data: { data: [], total: 0, page: 1, limit: 20, lastPage: 1 },
    isLoading: false,
  }),
  useAsset: () => ({ data: undefined, isLoading: false, error: new Error("Not found") }),
  useAssetStateTransitions: () => ({ data: undefined, isLoading: false }),
  useAssetAnalyses: () => ({ data: undefined, isLoading: false }),
  useAssetProcessingJob: () => ({ data: undefined, isLoading: false }),
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
  it("renders without crashing for any publicId (uses demo data fallback in Slice 0)", () => {
    render(
      <I18nProvider>
        <AssetDetailPage publicId="any-random-id" />
      </I18nProvider>,
    );
    // The page should render — state hero for the demo asset is "ready"
    // Multiple "ready" occurrences exist (state hero + preset statuses), so use getAllByText
    expect(screen.getAllByText(/ready/i).length).toBeGreaterThan(0);
  });

  it("renders all major section titles", () => {
    render(
      <I18nProvider>
        <AssetDetailPage publicId="test-id" />
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

  it("renders the public ID chip and copy button", () => {
    render(
      <I18nProvider>
        <AssetDetailPage publicId="test-id" />
      </I18nProvider>,
    );

    // The public ID from the demo asset should appear
    const publicIdText = screen.getByText("01HXJ8K3QF7T2ZN9V6BQWPDXM4");
    expect(publicIdText).toBeInTheDocument();
  });

  it("renders all 4 analyses", () => {
    render(
      <I18nProvider>
        <AssetDetailPage publicId="test-id" />
      </I18nProvider>,
    );

    expect(screen.getByText("Validator")).toBeInTheDocument();
    expect(screen.getByText("ClamAV virus scan")).toBeInTheDocument();
    expect(screen.getByText("EXIF extraction")).toBeInTheDocument();
    expect(screen.getByText("Content moderation")).toBeInTheDocument();
  });
});
