import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { I18nextProvider } from "react-i18next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LanguageSwitcher } from "./index";

// Mock react-i18next
const mockChangeLanguage = vi.fn().mockResolvedValue(undefined);
let mockLanguage = "en";

vi.mock("react-i18next", async () => {
  const actual = await vi.importActual("react-i18next");
  return {
    ...actual,
    useTranslation: () => ({
      i18n: {
        get language() {
          return mockLanguage;
        },
        changeLanguage: mockChangeLanguage,
      },
    }),
  };
});

// Test wrapper with i18n provider
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
);

describe("LanguageSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLanguage = "en";
  });

  afterEach(() => {
    cleanup();
  });

  describe("rendering", () => {
    it("renders the current language button", () => {
      render(
        <TestWrapper>
          <LanguageSwitcher />
        </TestWrapper>,
      );

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent("🇺🇸");
      expect(button).toHaveTextContent("English");
    });

    it("displays the correct flag and name for current language", () => {
      mockLanguage = "es";

      render(
        <TestWrapper>
          <LanguageSwitcher />
        </TestWrapper>,
      );

      const button = screen.getByRole("button");
      expect(button).toHaveTextContent("🇪🇸");
      expect(button).toHaveTextContent("Español");
    });

    it("falls back to Spanish when current language is not found", () => {
      mockLanguage = "fr"; // Unsupported language

      render(
        <TestWrapper>
          <LanguageSwitcher />
        </TestWrapper>,
      );

      const button = screen.getByRole("button");
      expect(button).toHaveTextContent("🇪🇸");
      expect(button).toHaveTextContent("Español");
    });

    it("applies correct button styling", () => {
      render(
        <TestWrapper>
          <LanguageSwitcher />
        </TestWrapper>,
      );

      const button = screen.getByRole("button");
      expect(button).toHaveClass("gap-2");
    });
  });

  describe("dropdown menu", () => {
    it("opens dropdown menu when button is clicked", async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <LanguageSwitcher />
        </TestWrapper>,
      );

      const button = screen.getByRole("button");
      await user.click(button);

      // Check if all language options are visible in the dropdown menu
      const menuItems = screen.getAllByRole("menuitem");
      expect(menuItems).toHaveLength(3);

      // Check that all language names are present in the dropdown menu
      const menu = screen.getByRole("menu");
      expect(within(menu).getByText("English")).toBeInTheDocument();
      expect(within(menu).getByText("Español")).toBeInTheDocument();
      expect(within(menu).getByText("Português")).toBeInTheDocument();
    });

    it("displays all available languages in dropdown", async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <LanguageSwitcher />
        </TestWrapper>,
      );

      const button = screen.getByRole("button");
      await user.click(button);

      // Check for flags and names in the dropdown menu
      const menuItems = screen.getAllByRole("menuitem");
      expect(menuItems).toHaveLength(3);

      // Check that all flags are present in the dropdown menu
      const menu = screen.getByRole("menu");
      expect(within(menu).getByText("🇺🇸")).toBeInTheDocument();
      expect(within(menu).getByText("🇪🇸")).toBeInTheDocument();
      expect(within(menu).getByText("🇧🇷")).toBeInTheDocument();
    });

    it("highlights the current language in dropdown", async () => {
      const user = userEvent.setup();
      mockLanguage = "es";

      render(
        <TestWrapper>
          <LanguageSwitcher />
        </TestWrapper>,
      );

      const button = screen.getByRole("button");
      await user.click(button);

      // Find the Spanish option in the dropdown menu and check if it has the highlight class
      const menuItems = screen.getAllByRole("menuitem");
      const spanishMenuItem = menuItems.find((item) => item.textContent.includes("Español"));
      expect(spanishMenuItem).toHaveClass("bg-gray-100");
    });
  });

  describe("language switching", () => {
    it("calls changeLanguage when a language is selected", async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <LanguageSwitcher />
        </TestWrapper>,
      );

      const button = screen.getByRole("button");
      await user.click(button);

      const spanishOption = screen.getByText("Español");
      await user.click(spanishOption);

      expect(mockChangeLanguage).toHaveBeenCalledWith("es");
    });

    it("calls changeLanguage with correct language code for Portuguese", async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <LanguageSwitcher />
        </TestWrapper>,
      );

      const button = screen.getByRole("button");
      await user.click(button);

      const portugueseOption = screen.getByText("Português");
      await user.click(portugueseOption);

      expect(mockChangeLanguage).toHaveBeenCalledWith("pt");
    });

    it("calls changeLanguage with correct language code for English", async () => {
      const user = userEvent.setup();
      mockLanguage = "es";

      render(
        <TestWrapper>
          <LanguageSwitcher />
        </TestWrapper>,
      );

      const button = screen.getByRole("button");
      await user.click(button);

      const englishOption = screen.getByText("English");
      await user.click(englishOption);

      expect(mockChangeLanguage).toHaveBeenCalledWith("en");
    });

    it("handles language change asynchronously", async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <LanguageSwitcher />
        </TestWrapper>,
      );

      const button = screen.getByRole("button");
      await user.click(button);

      const spanishOption = screen.getByText("Español");
      await user.click(spanishOption);

      // Verify the function was called and is async
      expect(mockChangeLanguage).toHaveBeenCalledWith("es");
      expect(mockChangeLanguage).toHaveBeenCalledTimes(1);
    });
  });

  describe("accessibility", () => {
    it("has proper button role", () => {
      render(
        <TestWrapper>
          <LanguageSwitcher />
        </TestWrapper>,
      );

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
    });

    it("dropdown menu items are accessible", async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <LanguageSwitcher />
        </TestWrapper>,
      );

      const button = screen.getByRole("button");
      await user.click(button);

      const menuItems = screen.getAllByRole("menuitem");
      expect(menuItems).toHaveLength(3);
    });

    it("supports keyboard navigation", () => {
      render(
        <TestWrapper>
          <LanguageSwitcher />
        </TestWrapper>,
      );

      const button = screen.getByRole("button", { name: /English/i });
      button.focus();

      // Test that the button is focusable
      expect(button).toHaveFocus();
    });
  });

  describe("responsive design", () => {
    it("hides language name on small screens", () => {
      render(
        <TestWrapper>
          <LanguageSwitcher />
        </TestWrapper>,
      );

      const button = screen.getByRole("button", { name: /English/i });
      const languageName = button.querySelector(String.raw`.hidden.sm\:inline`);

      expect(languageName).toBeInTheDocument();
      expect(languageName).toHaveClass("hidden", "sm:inline");
    });

    it("always shows the flag", () => {
      render(
        <TestWrapper>
          <LanguageSwitcher />
        </TestWrapper>,
      );

      const button = screen.getByRole("button", { name: /English/i });
      const flag = button.querySelector("span:first-child");

      expect(flag).toBeInTheDocument();
      expect(flag).toHaveTextContent("🇺🇸");
    });
  });
});
