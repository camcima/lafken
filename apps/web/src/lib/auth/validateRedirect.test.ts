import { describe, expect, it } from "vitest";

import { buildRedirectTarget, isSafeRedirectPath, sanitizeRedirectPath } from "./validateRedirect";

describe("isSafeRedirectPath", () => {
  it.each([
    ["/dashboard", true],
    ["/admin/users", true],
    ["/", true],
    ["/a?x=1&y=2", true],
    ["/a#section", true],
  ])("accepts same-origin absolute path %s", (input, expected) => {
    expect(isSafeRedirectPath(input)).toBe(expected);
  });

  it.each([
    ["//evil.com/harvest", "protocol-relative URL"],
    ["///evil.com", "multiple slash protocol-relative"],
    ["https://evil.com/", "absolute https URL"],
    ["http://evil.com/", "absolute http URL"],
    ["javascript:alert(1)", "javascript scheme"],
    ["JAVASCRIPT:alert(1)", "javascript scheme uppercase"],
    ["data:text/html,<script>alert(1)</script>", "data scheme"],
    ["vbscript:msgbox(1)", "vbscript scheme"],
    ["", "empty string"],
    ["dashboard", "no leading slash"],
    [" /dashboard", "leading whitespace"],
    ["/dashboard\n", "trailing newline"],
    ["/\t", "tab character"],
  ])("rejects %s (%s)", (input) => {
    expect(isSafeRedirectPath(input)).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isSafeRedirectPath(undefined)).toBe(false);
    expect(isSafeRedirectPath(null)).toBe(false);
    expect(isSafeRedirectPath(123)).toBe(false);
    expect(isSafeRedirectPath({})).toBe(false);
  });
});

describe("sanitizeRedirectPath", () => {
  it("returns the path unchanged when safe", () => {
    expect(sanitizeRedirectPath("/dashboard")).toBe("/dashboard");
    expect(sanitizeRedirectPath("/admin?x=1")).toBe("/admin?x=1");
  });

  it("returns the default fallback when unsafe", () => {
    expect(sanitizeRedirectPath("//evil.com")).toBe("/");
    expect(sanitizeRedirectPath("https://evil.com")).toBe("/");
    expect(sanitizeRedirectPath("javascript:alert(1)")).toBe("/");
    expect(sanitizeRedirectPath("")).toBe("/");
    expect(sanitizeRedirectPath(undefined)).toBe("/");
    expect(sanitizeRedirectPath(null)).toBe("/");
  });

  it("supports a custom fallback", () => {
    expect(sanitizeRedirectPath("//evil.com", "/home")).toBe("/home");
    expect(sanitizeRedirectPath(undefined, "/home")).toBe("/home");
  });

  it("default fallback is currently /", () => {
    // The fallback is type-checked against routeTree.gen.ts at build time
    // (see validateRedirect.ts). This runtime assertion documents the
    // current value so a change shows up as a deliberate test update.
    expect(sanitizeRedirectPath(undefined)).toBe("/");
  });

  it("rejects /auth/login as a redirect target to prevent loops", () => {
    expect(sanitizeRedirectPath("/auth/login")).toBe("/");
    expect(sanitizeRedirectPath("/auth/login?redirect=/foo")).toBe("/");
    expect(sanitizeRedirectPath("/auth/login/something")).toBe("/");
  });
});

describe("buildRedirectTarget", () => {
  it("captures pathname + search for a regular path", () => {
    expect(buildRedirectTarget("/admin", "?page=2")).toBe("/admin?page=2");
    expect(buildRedirectTarget("/admin")).toBe("/admin");
  });

  it("falls back to / when called from /auth/login itself", () => {
    expect(buildRedirectTarget("/auth/login", "?redirect=/foo")).toBe("/");
    expect(buildRedirectTarget("/auth/login")).toBe("/");
  });

  it("rejects nested redirect chains pointing back at login", () => {
    // Even if the captured pathname is /something but the search re-encodes
    // a redirect chain, the resulting joined value still has to pass
    // sanitizeRedirectPath, which strips /auth/login targets.
    expect(buildRedirectTarget("/auth/login/anything")).toBe("/");
  });
});
