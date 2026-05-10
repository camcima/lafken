import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/app-config", () => ({
  getRuntimeValue: vi.fn(() => "oidc"),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    auth: vi.fn(),
  },
}));

describe("createAuthProvider - oidc", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates an OIDCAuthAdapter", async () => {
    const { createAuthProvider } = await import("./AuthProviderFactory");
    const provider = await createAuthProvider();
    expect(provider.getProviderName()).toBe("oidc");
  });
});
