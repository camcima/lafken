import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { IdChip } from "./index";

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>);
}

afterEach(() => {
  cleanup();
});

describe("IdChip", () => {
  it("renders truncated id", () => {
    renderWithI18n(<IdChip id="12345678-abcd-efgh-ijkl-000000000000" />);
    expect(screen.getByText("12345678…")).toBeInTheDocument();
  });

  it("renders short id without truncation", () => {
    renderWithI18n(<IdChip id="short" />);
    expect(screen.getByText("short")).toBeInTheDocument();
  });

  it("renders the copy button with accessible label", () => {
    renderWithI18n(<IdChip id="abc123" />);
    const button = screen.getByRole("button", { name: "Copy to clipboard" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("data-slot", "id-chip");
  });

  it("copies to clipboard on click and shows copied state", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    renderWithI18n(<IdChip id="abc123" />);

    const button = screen.getByRole("button", { name: "Copy to clipboard" });
    await act(async () => {
      fireEvent.click(button);
      // allow the promise to resolve
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith("abc123");
    expect(screen.getByRole("button", { name: "Copied!" })).toBeInTheDocument();
  });

  it("applies custom className", () => {
    renderWithI18n(<IdChip id="abc123" className="custom-class" />);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("custom-class");
  });
});
