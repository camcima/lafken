import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { StatePill } from "./index";

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>);
}

afterEach(() => {
  cleanup();
});

describe("StatePill", () => {
  it("renders the label for pending state", () => {
    renderWithI18n(<StatePill state="pending" />);
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("renders the label for ready state", () => {
    renderWithI18n(<StatePill state="ready" />);
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  it("renders the label for processing state", () => {
    renderWithI18n(<StatePill state="processing" />);
    expect(screen.getByText("Processing")).toBeInTheDocument();
  });

  it("renders the label for rejected state", () => {
    renderWithI18n(<StatePill state="rejected" />);
    expect(screen.getByText("Rejected")).toBeInTheDocument();
  });

  it("renders the label for quarantined_virus state", () => {
    renderWithI18n(<StatePill state="quarantined_virus" />);
    expect(screen.getByText("Quarantined (virus)")).toBeInTheDocument();
  });

  it("renders the label for quarantined_moderation state", () => {
    renderWithI18n(<StatePill state="quarantined_moderation" />);
    expect(screen.getByText("Quarantined (moderation)")).toBeInTheDocument();
  });

  it("renders the label for processing_failed state", () => {
    renderWithI18n(<StatePill state="processing_failed" />);
    expect(screen.getByText("Processing failed")).toBeInTheDocument();
  });

  it("renders the label for expired state", () => {
    renderWithI18n(<StatePill state="expired" />);
    expect(screen.getByText("Expired")).toBeInTheDocument();
  });

  it("renders the label for deleted state", () => {
    renderWithI18n(<StatePill state="deleted" />);
    expect(screen.getByText("Deleted")).toBeInTheDocument();
  });

  it("renders the label for uploaded state", () => {
    renderWithI18n(<StatePill state="uploaded" />);
    expect(screen.getByText("Uploaded")).toBeInTheDocument();
  });

  it("sets data-slot and data-state attributes", () => {
    renderWithI18n(<StatePill state="ready" />);
    const pill = screen.getByText("Ready");
    expect(pill).toHaveAttribute("data-slot", "state-pill");
    expect(pill).toHaveAttribute("data-state", "ready");
  });

  it("applies ready state styles", () => {
    renderWithI18n(<StatePill state="ready" />);
    const pill = screen.getByText("Ready");
    expect(pill).toHaveClass("bg-ok-soft", "text-ok");
  });

  it("applies pending state styles", () => {
    renderWithI18n(<StatePill state="pending" />);
    const pill = screen.getByText("Pending");
    expect(pill).toHaveClass("bg-secondary", "text-muted-foreground");
  });

  it("applies custom className", () => {
    renderWithI18n(<StatePill state="ready" className="custom-class" />);
    const pill = screen.getByText("Ready");
    expect(pill).toHaveClass("custom-class");
  });
});
