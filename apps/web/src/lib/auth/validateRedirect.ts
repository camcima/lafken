import type { FileRouteTypes } from "@/routeTree.gen";

// Typed against the generated route tree so a route rename fails at
// build time instead of redirecting users to a 404 at runtime.
const DEFAULT_FALLBACK: FileRouteTypes["fullPaths"] = "/";

const LOGIN_PATH = "/auth/login";

export function isSafeRedirectPath(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  if (value[0] !== "/") return false;
  if (value[1] === "/" || value[1] === "\\") return false;
  return !/\s/.test(value);
}

export function sanitizeRedirectPath(value: unknown, fallback: string = DEFAULT_FALLBACK): string {
  if (!isSafeRedirectPath(value)) return fallback;
  // Block recursive login → login chains. Any time the captured URL is
  // itself /auth/login (with or without nested redirect= params), folding
  // it into a new redirect= would grow the URL on every re-render.
  if (
    value === LOGIN_PATH ||
    value.startsWith(`${LOGIN_PATH}?`) ||
    value.startsWith(`${LOGIN_PATH}/`)
  ) {
    return fallback;
  }
  return value;
}

/**
 * Builds the redirect target for an unauthenticated bounce. Captures the
 * caller's current pathname + search, but never the login route itself —
 * that would create a self-referential redirect that compounds across
 * re-renders into deeply nested URLs.
 */
export function buildRedirectTarget(pathname: string, searchStr = ""): string {
  if (pathname === LOGIN_PATH || pathname.startsWith(`${LOGIN_PATH}/`)) {
    return DEFAULT_FALLBACK;
  }
  return sanitizeRedirectPath(pathname + searchStr);
}
