import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { LanguageSelector } from "./LanguageSelector";

// Must be declared before imports that use react-i18next
const mockChangeLanguage = vi.fn().mockResolvedValue(undefined);

vi.mock("react-i18next", async () => {
  const actual = await vi.importActual<typeof import("react-i18next")>("react-i18next");
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => {
        // minimal translation map for the test
        const map: Record<string, string> = {
          "languages.label": "Language",
          "languages.displayLanguage": "Display language",
          "languages.perUserAuditLogged": "Per-user · audit-logged on change",
          "languages.en": "English",
          "languages.es": "Español",
          "languages.pt": "Português",
          "languages.region.en": "United States",
          "languages.region.es": "Latinoamérica",
          "languages.region.pt": "Brasil",
        };
        return map[key] ?? key;
      },
      i18n: {
        language: "en",
        changeLanguage: mockChangeLanguage,
      },
    }),
  };
});

function renderSelector() {
  return render(
    <I18nProvider>
      <LanguageSelector />
    </I18nProvider>,
  );
}

describe("LanguageSelector", () => {
  it("shows the current language short code from i18n.language", () => {
    renderSelector();
    expect(screen.getByText("EN")).toBeInTheDocument();
  });

  it("clicking the button opens the popover with 3 languages", async () => {
    const user = userEvent.setup();
    renderSelector();

    await user.click(screen.getByRole("button", { name: "Language" }));

    expect(screen.getByText("English")).toBeInTheDocument();
    expect(screen.getByText("Español")).toBeInTheDocument();
    expect(screen.getByText("Português")).toBeInTheDocument();
  });

  it("clicking a language calls i18n.changeLanguage with the language code", async () => {
    const user = userEvent.setup();
    renderSelector();

    // Open the popover
    await user.click(screen.getByRole("button", { name: "Language" }));

    // Click on Español
    await user.click(screen.getByText("Español"));

    expect(mockChangeLanguage).toHaveBeenCalledWith("es");
  });

  it("pressing Escape closes the popover", async () => {
    const user = userEvent.setup();
    renderSelector();

    // Open the popover
    await user.click(screen.getByRole("button", { name: "Language" }));
    expect(screen.getByText("English")).toBeInTheDocument();

    // Press Escape
    await user.keyboard("{Escape}");

    expect(screen.queryByText("English")).not.toBeInTheDocument();
  });
});
