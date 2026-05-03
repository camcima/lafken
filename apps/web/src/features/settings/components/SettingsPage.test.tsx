import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { SettingsPage } from "./SettingsPage";

vi.mock("@/hooks/useUserPreferences", () => ({
  useUserPreferencesStore: () => ({
    userPreferences: { theme: "light", language: "en", dateFormat: "DD/MM/YYYY" },
    setTheme: vi.fn(),
    setLanguage: vi.fn(),
    setDateFormat: vi.fn(),
  }),
  useTheme: () => "light",
  useLanguage: () => "en",
  useDateFormat: () => "DD/MM/YYYY",
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
    renderPage();
    // Workspace info visible by default
    expect(screen.getByText("LATAM Lafken (prod)")).toBeInTheDocument();
  });

  it("clicking Members tab shows member rows", () => {
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: /members/i }));
    // Paula Estrada is in DEMO_MEMBERS
    expect(screen.getByText("Paula Estrada")).toBeInTheDocument();
  });

  it("clicking API keys tab shows API key rows", () => {
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: /api keys/i }));
    // wo-app-prod-ios is in DEMO_API_KEYS
    expect(screen.getByText("wo-app-prod-ios")).toBeInTheDocument();
  });

  it("clicking Policies tab shows policy settings", () => {
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: /policies/i }));
    expect(screen.getByText(/default retention/i)).toBeInTheDocument();
    expect(screen.getByText(/moderation/i)).toBeInTheDocument();
  });

  it("clicking Danger zone tab shows danger actions", () => {
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: /danger/i }));
    expect(screen.getByText(/pause all uploads/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^pause$/i })).toBeInTheDocument();
  });

  it("switching tabs changes visible content", () => {
    renderPage();
    // Start on workspace tab
    expect(screen.getByText("LATAM Lafken (prod)")).toBeInTheDocument();

    // Switch to members
    fireEvent.click(screen.getByRole("tab", { name: /members/i }));
    expect(screen.queryByText("LATAM Lafken (prod)")).not.toBeInTheDocument();
    expect(screen.getByText("Paula Estrada")).toBeInTheDocument();
  });
});
