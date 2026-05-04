import type { StorageBindingResponseDTO } from "@shared/backend-api";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { SystemPage } from "./SystemPage";

const mutationStub = {
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue(undefined),
  isPending: false,
  isError: false,
  error: null,
};

const storageBindingsState: { value: StorageBindingResponseDTO[] } = { value: [] };

vi.mock("@/features/system/hooks/useSystem", () => ({
  useStorageBindings: () => ({ data: storageBindingsState.value, isLoading: false }),
  useStorageBinding: () => ({ data: undefined, isLoading: false }),
  useIntegrations: () => ({ data: [], isLoading: false }),
  useSystemHealth: () => ({
    data: { overall: "unknown", indicators: [], integrations: [] },
    isLoading: false,
  }),
  useCreateStorageBinding: () => mutationStub,
  useUpdateStorageBinding: () => mutationStub,
  useDeleteStorageBinding: () => mutationStub,
}));

describe("SystemPage", () => {
  beforeEach(() => {
    storageBindingsState.value = [];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

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

  it("renders the demo storage section with 3 binding rows when no real bindings exist", () => {
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

  it("renders the Add binding button", () => {
    render(
      <I18nProvider>
        <SystemPage />
      </I18nProvider>,
    );
    expect(screen.getByRole("button", { name: /add binding/i })).toBeInTheDocument();
  });

  it("renders real bindings when useStorageBindings returns data", () => {
    storageBindingsState.value = [
      {
        id: "1",
        name: "lafken-prod",
        adapterType: "gcs",
        config: { bucket: "lafken-bucket", projectId: "lafken-prj-1" },
        createdAt: "2026-01-15T00:00:00.000Z",
      },
    ];
    render(
      <I18nProvider>
        <SystemPage />
      </I18nProvider>,
    );
    expect(screen.getByText("lafken-prod")).toBeInTheDocument();
    // The demo binding name should NOT be visible when real data is present
    expect(screen.queryByText("gcs-prod-aircraft-evidence")).not.toBeInTheDocument();
  });
});
