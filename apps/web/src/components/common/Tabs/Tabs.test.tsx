import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Tabs } from "./Tabs";
import type { ITab } from "./Tabs";

afterEach(() => {
  cleanup();
});

const ITEMS: ITab<"all" | "active" | "archived">[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active", count: 3 },
  { id: "archived", label: "Archived", count: 0 },
];

describe("Tabs", () => {
  it("renders all tab labels", () => {
    render(<Tabs value="all" onValueChange={() => undefined} items={ITEMS} />);
    expect(screen.getByRole("tab", { name: /All/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Active/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Archived/i })).toBeInTheDocument();
  });

  it("sets aria-selected=true on the active tab", () => {
    render(<Tabs value="active" onValueChange={() => undefined} items={ITEMS} />);
    expect(screen.getByRole("tab", { name: /Active/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /All/i })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: /Archived/i })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("calls onValueChange with the tab id when clicked", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Tabs value="all" onValueChange={onValueChange} items={ITEMS} />);
    await user.click(screen.getByRole("tab", { name: /Active/i }));
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith("active");
  });

  it("does not call onValueChange when clicking the already active tab with same id", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Tabs value="all" onValueChange={onValueChange} items={ITEMS} />);
    await user.click(screen.getByRole("tab", { name: /All/i }));
    expect(onValueChange).toHaveBeenCalledWith("all");
  });

  it("renders count badge when count is provided", () => {
    render(<Tabs value="all" onValueChange={() => undefined} items={ITEMS} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders count badge when count is 0", () => {
    render(<Tabs value="all" onValueChange={() => undefined} items={ITEMS} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("does not render count badge when count is undefined", () => {
    const itemsNoCount: ITab[] = [{ id: "all", label: "All" }];
    render(<Tabs value="all" onValueChange={() => undefined} items={itemsNoCount} />);
    // The "All" tab text exists but no numeric count sibling
    const tab = screen.getByRole("tab", { name: /All/i });
    expect(tab.querySelector("span")).not.toBeInTheDocument();
  });

  it("applies custom className to the wrapper", () => {
    const { container } = render(
      <Tabs value="all" onValueChange={() => undefined} items={ITEMS} className="custom-tabs" />,
    );
    expect(container.firstChild).toHaveClass("custom-tabs");
  });

  it("renders the tablist role on the wrapper", () => {
    render(<Tabs value="all" onValueChange={() => undefined} items={ITEMS} />);
    expect(screen.getByRole("tablist")).toBeInTheDocument();
  });
});
