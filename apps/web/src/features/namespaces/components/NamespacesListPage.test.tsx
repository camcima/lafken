import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { NamespacesListPage } from "./NamespacesListPage";

vi.mock("@/features/namespaces/hooks/useNamespaces", () => ({
  useNamespaces: () => ({
    data: { data: [], total: 0, page: 1, limit: 20, lastPage: 1 },
    isLoading: false,
  }),
  useNamespace: () => ({ data: undefined, isLoading: false }),
  useNamespacePolicies: () => ({ data: undefined, isLoading: false }),
  useNamespacePresets: () => ({ data: undefined, isLoading: false }),
}));

describe("NamespacesListPage", () => {
  it("renders the empty state", () => {
    render(
      <I18nProvider>
        <NamespacesListPage />
      </I18nProvider>,
    );
    expect(screen.getByText(/no namespaces yet/i)).toBeInTheDocument();
  });

  it("renders the create namespace button as disabled", () => {
    render(
      <I18nProvider>
        <NamespacesListPage />
      </I18nProvider>,
    );
    const btn = screen.getByRole("button", { name: /create namespace/i });
    expect(btn).toBeDisabled();
  });
});
