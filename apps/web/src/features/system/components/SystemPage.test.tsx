import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { SystemPage } from "./SystemPage";

vi.mock("@/features/system/hooks/useSystem", () => ({
  useStorageBindings: () => ({ data: [], isLoading: false }),
  useStorageBinding: () => ({ data: undefined, isLoading: false }),
  useIntegrations: () => ({ data: [], isLoading: false }),
  useSystemHealth: () => ({
    data: { overall: "unknown", indicators: [], integrations: [] },
    isLoading: false,
  }),
}));

describe("SystemPage", () => {
  it("renders the title heading", () => {
    render(
      <I18nProvider>
        <SystemPage />
      </I18nProvider>,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/system status/i);
  });

  it("renders all 5 pipeline queue rows", () => {
    render(
      <I18nProvider>
        <SystemPage />
      </I18nProvider>,
    );
    expect(screen.getByText("validate")).toBeInTheDocument();
    expect(screen.getByText("av-scan")).toBeInTheDocument();
    expect(screen.getByText("exif-strip")).toBeInTheDocument();
    expect(screen.getByText("moderate")).toBeInTheDocument();
    expect(screen.getByText("transform")).toBeInTheDocument();
  });

  it("renders the storage section with 3 binding rows", () => {
    render(
      <I18nProvider>
        <SystemPage />
      </I18nProvider>,
    );
    expect(screen.getByText("gcs-prod-aircraft-evidence")).toBeInTheDocument();
    expect(screen.getByText("gcs-prod-cargo-claims")).toBeInTheDocument();
    expect(screen.getByText("gcs-prod-hr-docs")).toBeInTheDocument();
  });

  it("renders the dependencies section", () => {
    render(
      <I18nProvider>
        <SystemPage />
      </I18nProvider>,
    );
    expect(screen.getByText("moderation-v2")).toBeInTheDocument();
    expect(screen.getByText("clamav signatures")).toBeInTheDocument();
    expect(screen.getByText("kms (key vault)")).toBeInTheDocument();
  });

  it("renders the worker fleet with at least 6 workers", () => {
    render(
      <I18nProvider>
        <SystemPage />
      </I18nProvider>,
    );
    // Workers are labeled processor-01 through processor-24
    expect(screen.getByText("processor-01")).toBeInTheDocument();
    expect(screen.getByText("processor-06")).toBeInTheDocument();
  });

  it("renders the status banner", () => {
    render(
      <I18nProvider>
        <SystemPage />
      </I18nProvider>,
    );
    // The banner should show the degraded message since transform is alert
    expect(screen.getByText(/degraded/i)).toBeInTheDocument();
  });

  it("renders the public status page button", () => {
    render(
      <I18nProvider>
        <SystemPage />
      </I18nProvider>,
    );
    expect(screen.getByRole("button", { name: /public status page/i })).toBeInTheDocument();
  });
});
