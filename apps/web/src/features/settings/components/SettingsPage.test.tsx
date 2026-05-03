import { render, screen } from "@testing-library/react";
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

describe("SettingsPage", () => {
  it("renders the coming soon banner", () => {
    render(
      <I18nProvider>
        <SettingsPage />
      </I18nProvider>,
    );
    expect(screen.getByText(/persistent settings come in a later slice/i)).toBeInTheDocument();
  });

  it("renders all form labels", () => {
    render(
      <I18nProvider>
        <SettingsPage />
      </I18nProvider>,
    );
    expect(screen.getByText(/theme/i)).toBeInTheDocument();
    expect(screen.getByText(/language/i)).toBeInTheDocument();
    expect(screen.getByText(/date format/i)).toBeInTheDocument();
  });

  it("renders all form selects as disabled", () => {
    render(
      <I18nProvider>
        <SettingsPage />
      </I18nProvider>,
    );
    const selects = screen.getAllByRole("combobox");
    selects.forEach((select) => {
      expect(select).toBeDisabled();
    });
  });
});
