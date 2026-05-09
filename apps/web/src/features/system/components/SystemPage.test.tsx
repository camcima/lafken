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

  it("renders the empty state when no real bindings exist", () => {
    render(
      <I18nProvider>
        <SystemPage />
      </I18nProvider>,
    );
    expect(screen.getByText(/no storage bindings configured/i)).toBeInTheDocument();
  });

  it("renders the ok status banner by default", () => {
    render(
      <I18nProvider>
        <SystemPage />
      </I18nProvider>,
    );
    expect(screen.getByText(/all systems operational/i)).toBeInTheDocument();
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
  });
});
