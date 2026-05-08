import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { RelativeTime } from "./index";

const NOW = Date.parse("2026-05-06T12:00:00Z");

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>);
}

afterEach(() => {
  cleanup();
});

describe("RelativeTime", () => {
  it("renders an em-dash when iso is null", () => {
    renderWithI18n(<RelativeTime iso={null} now={NOW} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders an em-dash when iso is undefined", () => {
    renderWithI18n(<RelativeTime iso={undefined} now={NOW} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders an em-dash when iso is empty string", () => {
    renderWithI18n(<RelativeTime iso="" now={NOW} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders an em-dash when iso is unparseable", () => {
    renderWithI18n(<RelativeTime iso="not-a-date" now={NOW} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it('renders "just now" for a future timestamp', () => {
    renderWithI18n(<RelativeTime iso="2026-05-06T12:00:30Z" now={NOW} />);
    expect(screen.getByText("just now")).toBeInTheDocument();
  });

  it('renders "just now" for a sub-second delta', () => {
    renderWithI18n(<RelativeTime iso="2026-05-06T11:59:59.500Z" now={NOW} />);
    expect(screen.getByText("just now")).toBeInTheDocument();
  });

  it("renders seconds for under a minute", () => {
    renderWithI18n(<RelativeTime iso="2026-05-06T11:59:30Z" now={NOW} />);
    expect(screen.getByText("30s ago")).toBeInTheDocument();
  });

  it("renders minutes between 1 and 59", () => {
    renderWithI18n(<RelativeTime iso="2026-05-06T11:10:00Z" now={NOW} />);
    expect(screen.getByText("50m ago")).toBeInTheDocument();
  });

  it("renders hours between 1 and 23", () => {
    renderWithI18n(<RelativeTime iso="2026-05-06T07:00:00Z" now={NOW} />);
    expect(screen.getByText("5h ago")).toBeInTheDocument();
  });

  it("renders days between 1 and 6", () => {
    renderWithI18n(<RelativeTime iso="2026-05-04T12:00:00Z" now={NOW} />);
    expect(screen.getByText("2d ago")).toBeInTheDocument();
  });

  it("renders weeks for 7+ days", () => {
    renderWithI18n(<RelativeTime iso="2026-04-22T12:00:00Z" now={NOW} />);
    expect(screen.getByText("2w ago")).toBeInTheDocument();
  });

  it("emits a <time> element with dateTime attribute", () => {
    const iso = "2026-05-06T11:10:00Z";
    const { container } = renderWithI18n(<RelativeTime iso={iso} now={NOW} />);
    const time = container.querySelector("time");
    expect(time).not.toBeNull();
    expect(time).toHaveAttribute("dateTime", iso);
  });

  it("sets the title attribute to a human-readable absolute timestamp", () => {
    const { container } = renderWithI18n(
      <RelativeTime iso="2026-05-06T11:10:00Z" now={NOW} locale="en-US" />,
    );
    const time = container.querySelector("time");
    expect(time?.getAttribute("title")).toContain("2026");
    expect(time?.getAttribute("title")).toMatch(/May/);
  });
});
