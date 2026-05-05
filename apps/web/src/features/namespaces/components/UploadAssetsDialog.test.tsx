import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { UploadAssetsDialog } from "./UploadAssetsDialog";

vi.mock("@/lib/lafken-client", () => ({
  getLafkenClient: () => ({
    createUploadIntent: vi.fn(),
    confirmUpload: vi.fn(),
  }),
}));

vi.mock("@lafken/react", () => ({
  UploadDropzone: () => null,
}));

describe("UploadAssetsDialog", () => {
  it("renders dialog when open", () => {
    render(
      <I18nProvider>
        <UploadAssetsDialog open namespaceSlug="ns" onClose={() => {}} />
      </I18nProvider>,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/upload assets/i)).toBeInTheDocument();
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <I18nProvider>
        <UploadAssetsDialog open={false} namespaceSlug="ns" onClose={() => {}} />
      </I18nProvider>,
    );
    expect(container.firstChild).toBeNull();
  });
});
