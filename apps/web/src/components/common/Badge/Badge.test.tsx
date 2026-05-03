import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Badge } from "./Badge";

afterEach(() => {
  cleanup();
});

describe("Badge", () => {
  it("renders children", () => {
    render(<Badge>label</Badge>);
    expect(screen.getByText("label")).toBeInTheDocument();
  });

  it("default variant has secondary background", () => {
    render(<Badge variant="default">default</Badge>);
    const el = screen.getByText("default");
    expect(el).toHaveClass("bg-secondary");
  });

  it("indigo variant has indigo background", () => {
    render(<Badge variant="indigo">indigo</Badge>);
    const el = screen.getByText("indigo");
    expect(el).toHaveClass("bg-latam-indigo", "text-white");
  });

  it("pink variant has pink background", () => {
    render(<Badge variant="pink">pink</Badge>);
    const el = screen.getByText("pink");
    expect(el).toHaveClass("bg-latam-pink", "text-white");
  });

  it("indigo-soft variant has soft background", () => {
    render(<Badge variant="indigo-soft">indigo-soft</Badge>);
    const el = screen.getByText("indigo-soft");
    expect(el).toHaveClass("bg-[#ECE9FA]");
  });

  it("ok variant has ok-soft background", () => {
    render(<Badge variant="ok">ok</Badge>);
    const el = screen.getByText("ok");
    expect(el).toHaveClass("bg-ok-soft", "text-ok");
  });

  it("info variant has info-soft background", () => {
    render(<Badge variant="info">info</Badge>);
    const el = screen.getByText("info");
    expect(el).toHaveClass("bg-info-soft", "text-info");
  });

  it("warn variant has warn-soft background", () => {
    render(<Badge variant="warn">warn</Badge>);
    const el = screen.getByText("warn");
    expect(el).toHaveClass("bg-warn-soft", "text-warn");
  });

  it("alert variant has alert-soft background", () => {
    render(<Badge variant="alert">alert</Badge>);
    const el = screen.getByText("alert");
    expect(el).toHaveClass("bg-alert-soft", "text-alert");
  });

  it("danger variant has danger-soft background", () => {
    render(<Badge variant="danger">danger</Badge>);
    const el = screen.getByText("danger");
    expect(el).toHaveClass("bg-danger-soft", "text-danger");
  });

  it("muted variant has secondary background and muted foreground", () => {
    render(<Badge variant="muted">muted</Badge>);
    const el = screen.getByText("muted");
    expect(el).toHaveClass("bg-secondary", "text-muted-foreground");
  });

  it("applies custom className", () => {
    render(<Badge className="custom-badge">label</Badge>);
    const el = screen.getByText("label");
    expect(el).toHaveClass("custom-badge");
  });

  it("renders as a span element", () => {
    render(<Badge>span badge</Badge>);
    const el = screen.getByText("span badge");
    expect(el.tagName.toLowerCase()).toBe("span");
  });
});
