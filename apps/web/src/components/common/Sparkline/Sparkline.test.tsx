import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Sparkline } from "./Sparkline";

afterEach(() => {
  cleanup();
});

describe("Sparkline", () => {
  it("renders null when values array is empty", () => {
    const { container } = render(<Sparkline values={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders an svg with a polyline when values are provided", () => {
    const { container } = render(<Sparkline values={[1, 2, 3]} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.querySelector("polyline")).toBeInTheDocument();
  });

  it("renders the correct number of points in the polyline", () => {
    const values = [10, 20, 15, 30, 5];
    const { container } = render(<Sparkline values={values} />);
    const polyline = container.querySelector("polyline");
    expect(polyline).toBeInTheDocument();
    const rawPoints = polyline?.getAttribute("points") ?? "";
    const points = rawPoints.trim().split(" ");
    expect(points).toHaveLength(values.length);
  });

  it("renders a single point without crashing when values has one element", () => {
    const { container } = render(<Sparkline values={[42]} />);
    expect(container.querySelector("polyline")).toBeInTheDocument();
    const polyline = container.querySelector("polyline");
    const rawPoints = polyline?.getAttribute("points") ?? "";
    const points = rawPoints.trim().split(" ");
    expect(points).toHaveLength(1);
  });

  it("uses info stroke color by default", () => {
    const { container } = render(<Sparkline values={[1, 2, 3]} />);
    const polyline = container.querySelector("polyline");
    expect(polyline).toHaveAttribute("stroke", "#155579");
  });

  it("uses ok stroke color for ok tone", () => {
    const { container } = render(<Sparkline values={[1, 2, 3]} tone="ok" />);
    const polyline = container.querySelector("polyline");
    expect(polyline).toHaveAttribute("stroke", "#1A6B46");
  });

  it("uses warn stroke color for warn tone", () => {
    const { container } = render(<Sparkline values={[1, 2, 3]} tone="warn" />);
    const polyline = container.querySelector("polyline");
    expect(polyline).toHaveAttribute("stroke", "#8A5A07");
  });

  it("uses alert stroke color for alert tone", () => {
    const { container } = render(<Sparkline values={[1, 2, 3]} tone="alert" />);
    const polyline = container.querySelector("polyline");
    expect(polyline).toHaveAttribute("stroke", "#8A4209");
  });

  it("applies custom className to the svg", () => {
    const { container } = render(<Sparkline values={[1, 2, 3]} className="custom-sparkline" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("custom-sparkline");
  });
});
