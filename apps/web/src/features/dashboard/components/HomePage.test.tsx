import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { HomePage } from "./HomePage";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({
      children,
      className,
    }: {
      children: React.ReactNode;
      to: string;
      className?: string;
    }) => (
      // eslint-disable-next-line jsx-a11y/anchor-is-valid -- test mock; href not needed
      <a className={className}>{children}</a>
    ),
  };
});

vi.mock("@/features/dashboard/hooks/useDashboardOverview", () => ({
  useDashboardOverview: () => ({
    data: {
      counts: {
        totalAssets: 0,
        inFlight: 0,
        queueDepth: 0,
        quarantine: 0,
        legalHolds: 0,
        failedProcessing: 0,
      },
      health: { overall: "unknown", indicators: [], integrations: [] },
    },
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: {
      id: "u-1",
      email: "test@example.com",
      name: "Test User",
      roles: ["platform_operator"],
    },
    isAuthenticated: true,
    isLoading: false,
    logout: vi.fn(),
  }),
}));

describe("HomePage", () => {
  it("renders without crashing and shows the operator dashboard heading", () => {
    render(
      <I18nProvider>
        <HomePage />
      </I18nProvider>,
    );
    expect(screen.getByText("Operator dashboard")).toBeInTheDocument();
  });

  it("shows the Pipeline health section", () => {
    render(
      <I18nProvider>
        <HomePage />
      </I18nProvider>,
    );
    expect(screen.getByText("Pipeline health")).toBeInTheDocument();
  });

  it("shows the Needs attention section", () => {
    render(
      <I18nProvider>
        <HomePage />
      </I18nProvider>,
    );
    expect(screen.getByText("Needs attention")).toBeInTheDocument();
  });

  it("shows the Top namespaces section", () => {
    render(
      <I18nProvider>
        <HomePage />
      </I18nProvider>,
    );
    expect(screen.getByText("Top namespaces")).toBeInTheDocument();
  });

  it("shows the Live events section", () => {
    render(
      <I18nProvider>
        <HomePage />
      </I18nProvider>,
    );
    expect(screen.getByText("Live events")).toBeInTheDocument();
  });

  it("falls back to demo data when API returns empty counts", () => {
    render(
      <I18nProvider>
        <HomePage />
      </I18nProvider>,
    );
    // Demo total assets value
    expect(screen.getByText("2.42M")).toBeInTheDocument();
    // Demo quarantine count
    expect(screen.getByText("47")).toBeInTheDocument();
  });

  it("shows the attention banner with alert tone when transform queue is degraded", () => {
    render(
      <I18nProvider>
        <HomePage />
      </I18nProvider>,
    );
    expect(
      screen.getByText("1 pipeline stage degraded · transform queue is backing up"),
    ).toBeInTheDocument();
  });

  it("shows queue names in the pipeline health section", () => {
    render(
      <I18nProvider>
        <HomePage />
      </I18nProvider>,
    );
    expect(screen.getByText("validate")).toBeInTheDocument();
    expect(screen.getByText("transform")).toBeInTheDocument();
  });

  it("shows the view full audit log link", () => {
    render(
      <I18nProvider>
        <HomePage />
      </I18nProvider>,
    );
    expect(screen.getByText("View full audit log →")).toBeInTheDocument();
  });
});
