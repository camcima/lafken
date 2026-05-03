import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MockAuthAdapter } from "./MockAuthAdapter";
import { mockUser } from "./user";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), auth: vi.fn() },
}));

describe("MockAuthAdapter", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it("starts unauthenticated and only logs in after explicit login()", async () => {
    const adapter = new MockAuthAdapter();
    await adapter.initialize();

    expect(await adapter.getUser()).toBeNull();
    expect(await adapter.isAuthenticated()).toBe(false);

    await adapter.login();

    expect(await adapter.getUser()).toEqual(mockUser);
    expect(await adapter.isAuthenticated()).toBe(true);
  });

  it("ignores sessionStorage MOCK_ROLES and returns the default mock user's roles", async () => {
    sessionStorage.setItem("MOCK_ROLES", JSON.stringify(["supervisor", "finance"]));

    const adapter = new MockAuthAdapter();
    await adapter.initialize();
    await adapter.login();

    const user = await adapter.getUser();
    expect(user?.roles).toEqual(mockUser.roles);
    expect(user?.roles).not.toContain("finance");
  });

  it("does not read sessionStorage during login", async () => {
    const getItemSpy = vi.spyOn(Storage.prototype, "getItem");

    const adapter = new MockAuthAdapter();
    await adapter.login();

    const mockRolesReads = getItemSpy.mock.calls.filter(([key]) => key === "MOCK_ROLES");
    expect(mockRolesReads).toHaveLength(0);

    getItemSpy.mockRestore();
  });
});
