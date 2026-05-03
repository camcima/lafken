import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

import { HomePage } from "./HomePage";

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
  it("renders without crashing and shows zeroed stats", () => {
    render(
      <I18nProvider>
        <HomePage />
      </I18nProvider>,
    );
    expect(screen.getByText(/total assets/i)).toBeInTheDocument();
  });
});
