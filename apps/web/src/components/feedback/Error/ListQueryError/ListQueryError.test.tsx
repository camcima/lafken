import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { ListQueryError } from "./index";

afterEach(cleanup);

describe("ListQueryError", () => {
  it("renders an alert with title and description", () => {
    render(
      <I18nProvider>
        <ListQueryError onRetry={() => {}} />
      </I18nProvider>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/couldn't load this list/i)).toBeInTheDocument();
  });

  it("calls onRetry when the retry button is clicked", async () => {
    const onRetry = vi.fn();
    render(
      <I18nProvider>
        <ListQueryError onRetry={onRetry} />
      </I18nProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("marks the retry button busy and disabled while a retry is in flight", () => {
    render(
      <I18nProvider>
        <ListQueryError onRetry={() => {}} isRetrying />
      </I18nProvider>,
    );
    const retryButton = screen.getByRole("button", { name: /retry/i });
    expect(retryButton).toBeDisabled();
    expect(retryButton).toHaveAttribute("aria-busy", "true");
  });
});
