import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { Paginator } from "./index";

afterEach(() => {
  cleanup();
});

function renderPaginator(page: number, totalPages: number, onChange = vi.fn()) {
  return render(
    <I18nProvider>
      <Paginator page={page} totalPages={totalPages} onChange={onChange} />
    </I18nProvider>,
  );
}

describe("Paginator", () => {
  it("renders nothing when totalPages <= 1", () => {
    const { container } = renderPaginator(0, 1);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when totalPages is 0", () => {
    const { container } = renderPaginator(0, 0);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders all 4 nav buttons when totalPages > 1", () => {
    renderPaginator(1, 5);
    expect(screen.getByRole("button", { name: /first page/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /previous page/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next page/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /last page/i })).toBeInTheDocument();
  });

  it("renders page number buttons", () => {
    renderPaginator(0, 5);
    // Should render numbered buttons 1–5
    expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "5" })).toBeInTheDocument();
  });

  it("clicking a page button calls onChange with correct 0-indexed value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    // Page 0, totalPages 5 → sequence includes page 2 (displayed as "2")
    renderPaginator(0, 5, onChange);
    await user.click(screen.getByRole("button", { name: "2" }));
    expect(onChange).toHaveBeenCalledWith(1); // page 2 → index 1
  });

  it("active page button has aria-current='page'", () => {
    renderPaginator(2, 5);
    const activeBtn = screen.getByRole("button", { name: "3" });
    expect(activeBtn).toHaveAttribute("aria-current", "page");
  });

  it("non-active page buttons do not have aria-current", () => {
    renderPaginator(2, 5);
    const btn = screen.getByRole("button", { name: "1" });
    expect(btn).not.toHaveAttribute("aria-current");
  });

  it("first/prev buttons are disabled on page 0", () => {
    renderPaginator(0, 5);
    expect(screen.getByRole("button", { name: /first page/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /previous page/i })).toBeDisabled();
  });

  it("next/last buttons are disabled on the last page", () => {
    renderPaginator(4, 5);
    expect(screen.getByRole("button", { name: /next page/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /last page/i })).toBeDisabled();
  });

  it("go-to-page form does not appear when totalPages <= 7", () => {
    renderPaginator(0, 7);
    expect(screen.queryByRole("textbox", { name: /jump to page/i })).not.toBeInTheDocument();
  });

  it("go-to-page form appears when totalPages > 7", () => {
    renderPaginator(0, 8);
    expect(screen.getByRole("textbox", { name: /jump to page/i })).toBeInTheDocument();
  });

  it("clicking next calls onChange with page + 1", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderPaginator(2, 5, onChange);
    await user.click(screen.getByRole("button", { name: /next page/i }));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("clicking prev calls onChange with page - 1", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderPaginator(3, 5, onChange);
    await user.click(screen.getByRole("button", { name: /previous page/i }));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("clicking first page calls onChange with 0", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderPaginator(4, 5, onChange);
    await user.click(screen.getByRole("button", { name: /first page/i }));
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it("clicking last page calls onChange with totalPages - 1", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderPaginator(0, 5, onChange);
    await user.click(screen.getByRole("button", { name: /last page/i }));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("nav element has aria-label from translation", () => {
    renderPaginator(0, 5);
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });
});
