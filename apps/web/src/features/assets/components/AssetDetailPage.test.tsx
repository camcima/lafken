import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { AssetDetailPage } from "./AssetDetailPage";

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
  it("renders the not-found empty state when asset is undefined", () => {
    render(
      <I18nProvider>
        <AssetDetailPage publicId="test-id" />
      </I18nProvider>,
    );
    expect(screen.getByText(/asset not found/i)).toBeInTheDocument();
  });

  it("renders the back-to-assets action link", () => {
    render(
      <I18nProvider>
        <AssetDetailPage publicId="test-id" />
      </I18nProvider>,
    );
    expect(screen.getByText(/back to assets/i)).toBeInTheDocument();
  });
});
