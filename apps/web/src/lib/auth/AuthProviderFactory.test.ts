import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/app-config", () => ({
  getRuntimeValue: vi.fn(() => ""),
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

describe("createAuthProvider - mock guard", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws when providerType is mock and MODE is production", async () => {
    vi.stubEnv("MODE", "production");
    const { createAuthProvider } = await import("./AuthProviderFactory");

    await expect(createAuthProvider({ providerType: "mock" })).rejects.toThrow(/mock.*production/i);
  });

  it("loads the mock adapter when MODE is test", async () => {
    vi.stubEnv("MODE", "test");
    const { createAuthProvider } = await import("./AuthProviderFactory");

    const provider = await createAuthProvider({ providerType: "mock" });
    expect(provider.getProviderName()).toBe("mock");
  });

  it("loads the mock adapter when MODE is development", async () => {
    vi.stubEnv("MODE", "development");
    const { createAuthProvider } = await import("./AuthProviderFactory");

    const provider = await createAuthProvider({ providerType: "mock" });
    expect(provider.getProviderName()).toBe("mock");
  });
});
