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
  it("renders the no storage bindings empty state", () => {
    render(
      <I18nProvider>
        <SystemPage />
      </I18nProvider>,
    );
    expect(screen.getByText(/no storage bindings configured/i)).toBeInTheDocument();
  });

  it("renders the no health indicators empty state", () => {
    render(
      <I18nProvider>
        <SystemPage />
      </I18nProvider>,
    );
    expect(screen.getByText(/no health indicators yet/i)).toBeInTheDocument();
  });

  it("renders the section headings", () => {
    render(
      <I18nProvider>
        <SystemPage />
      </I18nProvider>,
    );
    expect(screen.getAllByText(/storage bindings/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/integrations/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/system health/i)).toBeInTheDocument();
  });
});
