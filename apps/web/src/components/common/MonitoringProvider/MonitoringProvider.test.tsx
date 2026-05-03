import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthUser } from "@/lib/auth/interface/IAuthProvider";

const mockInitFaro = vi.fn();
let mockUser: AuthUser | null = null;
let mockMonitoringUrl = "";

vi.mock("@/lib/monitoring/faro", () => ({
  initFaro: (user: AuthUser) => {
    mockInitFaro(user);
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mockUser,
    isAuthenticated: mockUser !== null,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    getAccessToken: vi.fn(),
    whenReady: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@/config/app-config", () => ({
  getRuntimeValue: (key: string) => {
    if (key === "MONITORING_URL") return mockMonitoringUrl;
    return "";
  },
}));

const buildUser = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  id: "user-1",
  email: "u@example.com",
  name: "User One",
  ...overrides,
});

describe("MonitoringProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = null;
    mockMonitoringUrl = "";
  });

  afterEach(() => {
    cleanup();
  });

  it("does not call initFaro when MONITORING_URL is empty", async () => {
    mockUser = buildUser();
    mockMonitoringUrl = "";
    const { MonitoringProvider } = await import("./index");

    render(
      <MonitoringProvider>
        <div data-testid="children">child</div>
      </MonitoringProvider>,
    );

    expect(mockInitFaro).not.toHaveBeenCalled();
    expect(screen.getByTestId("children")).toBeInTheDocument();
  });

  it("calls initFaro exactly once after the user becomes available", async () => {
    mockUser = buildUser();
    mockMonitoringUrl = "https://faro.example.com/collect";
    const { MonitoringProvider } = await import("./index");

    const { rerender } = render(
      <MonitoringProvider>
        <div data-testid="children">child</div>
      </MonitoringProvider>,
    );

    expect(mockInitFaro).toHaveBeenCalledTimes(1);
    expect(mockInitFaro).toHaveBeenCalledWith(expect.objectContaining({ id: "user-1" }));

    rerender(
      <MonitoringProvider>
        <div data-testid="children">child</div>
      </MonitoringProvider>,
    );

    expect(mockInitFaro).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("children")).toBeInTheDocument();
  });

  it("does not call initFaro when the user is null", async () => {
    mockUser = null;
    mockMonitoringUrl = "https://faro.example.com/collect";
    const { MonitoringProvider } = await import("./index");

    render(
      <MonitoringProvider>
        <div data-testid="children">child</div>
      </MonitoringProvider>,
    );

    expect(mockInitFaro).not.toHaveBeenCalled();
    // Children always render — gating is the parent route's job; the
    // provider is observability-only and must not block UI.
    expect(screen.getByTestId("children")).toBeInTheDocument();
  });
});
