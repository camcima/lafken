import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { SettingsPage } from "./SettingsPage";

const mockNavigate = vi.fn();
let mockTab = "workspace";

vi.mock("@tanstack/react-router", () => ({
  useSearch: () => ({ tab: mockTab }),
  useNavigate: () => mockNavigate,
}));

function renderPage() {
  return render(
    <I18nProvider>
      <SettingsPage />
    </I18nProvider>,
  );
}

describe("SettingsPage", () => {
  it("renders the page title", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: /settings/i })).toBeInTheDocument();
  });

  it("renders all tab labels", () => {
    renderPage();
    expect(screen.getByRole("tab", { name: /workspace/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /members/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /api keys/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /policies/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /danger/i })).toBeInTheDocument();
  });

  it("workspace tab is shown by default", () => {
    mockTab = "workspace";
    renderPage();
    // Workspace info visible by default
    expect(screen.getByText("LATAM Lafken (prod)")).toBeInTheDocument();
  });

  it("clicking Members tab calls navigate with members tab", () => {
    mockTab = "workspace";
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: /members/i }));
    expect(mockNavigate).toHaveBeenCalledWith({ search: { tab: "members" } });
  });

  it("members tab shows the empty state when tab=members", () => {
    mockTab = "members";
    renderPage();
    expect(screen.getByText(/no members yet/i)).toBeInTheDocument();
  });

  it("clicking API keys tab calls navigate with api tab", () => {
    mockTab = "workspace";
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: /api keys/i }));
    expect(mockNavigate).toHaveBeenCalledWith({ search: { tab: "api" } });
  });

  it("api tab shows the empty state when tab=api", () => {
    mockTab = "api";
    renderPage();
    expect(screen.getByText(/no api keys yet/i)).toBeInTheDocument();
  });

  it("policies tab shows policy settings when tab=policies", () => {
    mockTab = "policies";
    renderPage();
    expect(screen.getByText(/default retention/i)).toBeInTheDocument();
    expect(screen.getByText(/moderation/i)).toBeInTheDocument();
  });

  it("danger tab shows danger actions when tab=danger", () => {
    mockTab = "danger";
    renderPage();
    expect(screen.getByText(/pause all uploads/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^pause$/i })).toBeInTheDocument();
  });

  it("switching tabs changes visible content", () => {
    mockTab = "workspace";
    const { rerender } = renderPage();
    // Start on workspace tab
    expect(screen.getByText("LATAM Lafken (prod)")).toBeInTheDocument();

    // Simulate URL change to members
    mockTab = "members";
    rerender(
      <I18nProvider>
        <SettingsPage />
      </I18nProvider>,
    );
    expect(screen.queryByText("LATAM Lafken (prod)")).not.toBeInTheDocument();
    expect(screen.getByText(/no members yet/i)).toBeInTheDocument();
  });
});
