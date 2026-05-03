import { cleanup, render, screen } from "@testing-library/react";
import { FolderOpen } from "lucide-react";
import { afterEach, describe, expect, it } from "vitest";

import { EmptyState } from "./index";

afterEach(() => {
  cleanup();
});

describe("EmptyState", () => {
  it("renders title", () => {
    render(<EmptyState title="No assets found" />);
    expect(screen.getByText("No assets found")).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    render(<EmptyState title="No assets" description="Upload something to get started" />);
    expect(screen.getByText("Upload something to get started")).toBeInTheDocument();
  });

  it("does not render description when not provided", () => {
    render(<EmptyState title="No assets" />);
    expect(screen.queryByText("Upload something to get started")).not.toBeInTheDocument();
  });

  it("renders action when provided", () => {
    render(<EmptyState title="No assets" action={<button type="button">Upload</button>} />);
    expect(screen.getByRole("button", { name: "Upload" })).toBeInTheDocument();
  });

  it("does not render action when not provided", () => {
    render(<EmptyState title="No assets" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders icon when provided", () => {
    render(<EmptyState title="No assets" icon={FolderOpen} />);
    const container = screen.getByText("No assets").closest("[data-slot='empty-state']");
    expect(container?.querySelector("svg")).toBeInTheDocument();
  });

  it("does not render icon wrapper when no icon provided", () => {
    render(<EmptyState title="No assets" />);
    const container = screen.getByText("No assets").closest("[data-slot='empty-state']");
    expect(container?.querySelector("svg")).not.toBeInTheDocument();
  });

  it("sets data-slot attribute", () => {
    render(<EmptyState title="No assets" />);
    const element = document.querySelector("[data-slot='empty-state']");
    expect(element).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<EmptyState title="No assets" className="custom-class" />);
    const element = document.querySelector("[data-slot='empty-state']");
    expect(element).toHaveClass("custom-class");
  });
});
