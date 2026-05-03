import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import NotFound from "./index";

let mockIsAuthenticated = true;
const mockNavigate = vi.fn();

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
    isLoading: false,
    user: mockIsAuthenticated ? { id: "u", email: "u@x", name: "U" } : null,
    login: vi.fn(),
    logout: vi.fn(),
    getAccessToken: vi.fn(),
    whenReady: vi.fn().mockResolvedValue(undefined),
  }),
}));

const mockNavigateRedirect = vi.fn<(redirect: string) => void>();

vi.mock("@tanstack/react-router", () => ({
  Navigate: ({ to, search }: { to: string; search?: { redirect?: string } }) => {
    mockNavigate(to);
    if (search?.redirect) mockNavigateRedirect(search.redirect);
    return <div data-testid="navigate-stub" data-to={to} data-redirect={search?.redirect} />;
  },
}));

describe("NotFound", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAuthenticated = true;
    // jsdom defaults to http://localhost/. Stub a deep unmatched path
    // so the unauthenticated branch can capture it.
    Object.defineProperty(globalThis, "location", {
      value: new URL("http://localhost/some/missing/path"),
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe("when authenticated", () => {
    it("renders 404 message", () => {
      render(<NotFound />);

      expect(screen.getByText("404")).toBeInTheDocument();
      expect(screen.getByText("Página no encontrada")).toBeInTheDocument();
    });

    it("renders description text", () => {
      render(<NotFound />);

      expect(screen.getByText(/la página que buscas no existe/i)).toBeInTheDocument();
    });

    it("renders back to home link", () => {
      render(<NotFound />);

      const homeLink = screen.getByRole("link", { name: /volver al inicio/i });
      expect(homeLink).toBeInTheDocument();
      expect(homeLink).toHaveAttribute("href", "/");
    });

    it("has proper accessibility attributes", () => {
      render(<NotFound />);

      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent("404");
    });

    it("renders all elements together", () => {
      render(<NotFound />);

      expect(screen.getByText("404")).toBeInTheDocument();
      expect(screen.getByText("Página no encontrada")).toBeInTheDocument();
      expect(screen.getByText(/la página que buscas no existe/i)).toBeInTheDocument();

      const homeLink = screen.getByRole("link", { name: /volver al inicio/i });
      expect(homeLink).toBeInTheDocument();
      expect(homeLink).toHaveAttribute("href", "/");
    });
  });

  describe("when unauthenticated", () => {
    it("redirects to /auth/login with the current path as redirect", () => {
      mockIsAuthenticated = false;

      render(<NotFound />);

      expect(screen.getByTestId("navigate-stub")).toHaveAttribute("data-to", "/auth/login");
      expect(mockNavigate).toHaveBeenCalledWith("/auth/login");
      expect(mockNavigateRedirect).toHaveBeenCalledWith("/some/missing/path");
      expect(screen.queryByText("404")).not.toBeInTheDocument();
    });

    it("preserves search params from the unmatched URL", () => {
      mockIsAuthenticated = false;
      Object.defineProperty(globalThis, "location", {
        value: new URL("http://localhost/admin/users?page=2"),
        writable: true,
        configurable: true,
      });

      render(<NotFound />);

      expect(mockNavigateRedirect).toHaveBeenCalledWith("/admin/users?page=2");
    });
  });
});
