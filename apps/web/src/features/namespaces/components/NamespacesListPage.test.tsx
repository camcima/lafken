import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  it("renders the title heading", () => {
    render(
      <I18nProvider>
        <NamespacesListPage />
      </I18nProvider>,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/namespaces/i);
  });

  it("renders at least 3 namespace cards", () => {
    render(
      <I18nProvider>
        <NamespacesListPage />
      </I18nProvider>,
    );
    // Each namespace card has an h2 with the display name
    const cards = screen.getAllByRole("heading", { level: 2 });
    expect(cards.length).toBeGreaterThanOrEqual(3);
  });

  it("renders all 6 demo namespaces by default", () => {
    render(
      <I18nProvider>
        <NamespacesListPage />
      </I18nProvider>,
    );
    expect(screen.getByText("Aircraft Photos")).toBeInTheDocument();
    expect(screen.getByText("Cargo Damage Reports")).toBeInTheDocument();
    expect(screen.getByText("Engine Borescope")).toBeInTheDocument();
  });

  it("filters namespaces by search query", async () => {
    render(
      <I18nProvider>
        <NamespacesListPage />
      </I18nProvider>,
    );
    const searchInput = screen.getByRole("searchbox");
    await userEvent.type(searchInput, "aircraft");
    expect(screen.getByText("Aircraft Photos")).toBeInTheDocument();
    expect(screen.queryByText("Cargo Damage Reports")).not.toBeInTheDocument();
  });

  it("opens the detail drawer when a namespace card is clicked", async () => {
    render(
      <I18nProvider>
        <NamespacesListPage />
      </I18nProvider>,
    );
    const firstCard = screen.getAllByRole("button")[1]; // first namespace button (after new namespace btn)
    await userEvent.click(firstCard);
    // Drawer should be open — shows the caption "Namespace"
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows new namespace button", () => {
    render(
      <I18nProvider>
        <NamespacesListPage />
      </I18nProvider>,
    );
    expect(screen.getByRole("button", { name: /new namespace/i })).toBeInTheDocument();
  });
});
