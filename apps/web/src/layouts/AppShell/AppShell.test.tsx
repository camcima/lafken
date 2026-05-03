import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/lib/i18n/i18n-test-provider";

// Import after mocks are set up
import { AppShell } from "./index";

// Sonner's Toaster calls window.matchMedia which is not available in jsdom
vi.mock("@/components/feedback/Success/Sonner", () => ({
  Toaster: () => null,
}));

vi.mock("@tanstack/react-router", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
  return {
    ...actual,
    useRouterState: ({
      select,
    }: {
      select?: (s: unknown) => unknown;
    } = {}): unknown =>
      select ? select({ location: { pathname: "/" } }) : { location: { pathname: "/" } },
    Link: ({ children, ...props }: { children: React.ReactNode; [k: string]: unknown }) => (
      <a {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>{children}</a>
    ),
    Outlet: () => <div data-testid="outlet" />,
  };
});

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

vi.mock("@/features/dashboard/hooks/useDashboardOverview", () => ({
  useDashboardOverview: () => ({ data: undefined, isLoading: false }),
}));

describe("AppShell", () => {
  it("renders LAFKEN branding and sidebar", () => {
    render(
      <I18nProvider>
        <AppShell />
      </I18nProvider>,
    );

    expect(screen.getByTestId("app-sidebar")).toBeInTheDocument();
    expect(screen.getByText(/LAFKEN/)).toBeInTheDocument();
  });

  it("renders navigation links for a platform_operator", () => {
    render(
      <I18nProvider>
        <AppShell />
      </I18nProvider>,
    );

    const sidebar = screen.getByTestId("app-sidebar");

    // workspace links — always visible
    expect(sidebar).toHaveTextContent("Home");
    expect(sidebar).toHaveTextContent("Assets");
    expect(sidebar).toHaveTextContent("Namespaces");

    // review links — visible for platform_operator
    expect(sidebar).toHaveTextContent("Quarantine");
    expect(sidebar).toHaveTextContent("Legal holds");
    expect(sidebar).toHaveTextContent("Audit");

    // platform links — visible for platform_operator
    expect(sidebar).toHaveTextContent("System");
    expect(sidebar).toHaveTextContent("Settings");
  });

  it("renders the outlet placeholder inside main", () => {
    render(
      <I18nProvider>
        <AppShell />
      </I18nProvider>,
    );
    expect(screen.getByTestId("outlet")).toBeInTheDocument();
  });
});
