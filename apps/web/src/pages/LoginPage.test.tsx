import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let mockIsAuthenticated = false;
let mockRedirect = "/";
const mockNavigate = vi.fn();

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
    isLoading: false,
    user: null,
    login: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn(),
    getAccessToken: vi.fn(),
    whenReady: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  Navigate: ({ to }: { to: string }) => {
    mockNavigate(to);
    return <div data-testid="navigate-stub" data-to={to} />;
  },
  useSearch: () => ({ redirect: mockRedirect }),
}));

vi.mock("@/components/auth/LoginWelcome", () => ({
  LoginWelcome: ({ redirectPath }: { redirectPath?: string }) => (
    <div data-testid="login-welcome-stub" data-redirect={redirectPath} />
  ),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    auth: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    performance: vi.fn(),
    setUser: vi.fn(),
    clearUser: vi.fn(),
  },
}));

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAuthenticated = false;
    mockRedirect = "/";
  });

  afterEach(() => {
    cleanup();
  });

  it("renders LoginWelcome with the redirect path when unauthenticated", async () => {
    mockRedirect = "/";
    const { default: LoginPage } = await import("./LoginPage");

    render(<LoginPage />);

    expect(screen.getByTestId("login-welcome-stub")).toHaveAttribute("data-redirect", "/");
    expect(screen.queryByTestId("navigate-stub")).not.toBeInTheDocument();
  });

  it("preserves a non-default redirect search param in LoginWelcome props", async () => {
    mockRedirect = "/protected-page?x=1";
    const { default: LoginPage } = await import("./LoginPage");

    render(<LoginPage />);

    expect(screen.getByTestId("login-welcome-stub")).toHaveAttribute(
      "data-redirect",
      "/protected-page?x=1",
    );
  });

  it("navigates to the redirect target when authenticated", async () => {
    mockIsAuthenticated = true;
    mockRedirect = "/";
    const { default: LoginPage } = await import("./LoginPage");

    render(<LoginPage />);

    expect(screen.getByTestId("navigate-stub")).toHaveAttribute("data-to", "/");
    expect(mockNavigate).toHaveBeenCalledWith("/");
    expect(screen.queryByTestId("login-welcome-stub")).not.toBeInTheDocument();
  });

  it("navigates to a non-default redirect target when authenticated", async () => {
    mockIsAuthenticated = true;
    mockRedirect = "/admin";
    const { default: LoginPage } = await import("./LoginPage");

    render(<LoginPage />);

    expect(mockNavigate).toHaveBeenCalledWith("/admin");
    expect(screen.getByTestId("navigate-stub")).toHaveAttribute("data-to", "/admin");
  });
});
