import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Card } from "./Card";
import { CardContent } from "./CardContent";
import { CardHeader } from "./CardHeader";
import { CardMeta } from "./CardMeta";
import { CardTitle } from "./CardTitle";

afterEach(() => {
  cleanup();
});

describe("Card", () => {
  it("renders children", () => {
    render(<Card>card content</Card>);
    expect(screen.getByText("card content")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<Card className="custom-class">content</Card>);
    const el = screen.getByText("content");
    expect(el).toHaveClass("custom-class");
  });

  it("has default border and background classes", () => {
    render(<Card>content</Card>);
    const el = screen.getByText("content");
    expect(el).toHaveClass("rounded-md", "border", "shadow-sm");
  });
});

describe("CardHeader", () => {
  it("renders children", () => {
    render(<CardHeader>header content</CardHeader>);
    expect(screen.getByText("header content")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    render(<CardHeader className="custom-header">header</CardHeader>);
    const el = screen.getByText("header");
    expect(el).toHaveClass("custom-header");
  });
});

describe("CardTitle", () => {
  it("renders as h3", () => {
    render(<CardTitle>My Title</CardTitle>);
    const el = screen.getByRole("heading", { level: 3 });
    expect(el).toHaveTextContent("My Title");
  });

  it("applies custom className", () => {
    render(<CardTitle className="custom-title">title</CardTitle>);
    const el = screen.getByRole("heading", { level: 3 });
    expect(el).toHaveClass("custom-title");
  });
});

describe("CardMeta", () => {
  it("renders children", () => {
    render(<CardMeta>meta info</CardMeta>);
    expect(screen.getByText("meta info")).toBeInTheDocument();
  });

  it("applies ml-auto for right alignment", () => {
    render(<CardMeta>meta</CardMeta>);
    const el = screen.getByText("meta");
    expect(el).toHaveClass("ml-auto");
  });

  it("applies custom className", () => {
    render(<CardMeta className="custom-meta">meta</CardMeta>);
    const el = screen.getByText("meta");
    expect(el).toHaveClass("custom-meta");
  });
});

describe("CardContent", () => {
  it("renders children", () => {
    render(<CardContent>body content</CardContent>);
    expect(screen.getByText("body content")).toBeInTheDocument();
  });

  it("applies padding class", () => {
    render(<CardContent>content</CardContent>);
    const el = screen.getByText("content");
    expect(el).toHaveClass("p-5");
  });

  it("applies custom className", () => {
    render(<CardContent className="custom-content">content</CardContent>);
    const el = screen.getByText("content");
    expect(el).toHaveClass("custom-content");
  });
});
