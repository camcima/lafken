import { describe, expect, it } from "vitest";

import { AllowAllAuthorizationAdapter } from "@/shared/infrastructure/authorization/allow-all-authorization.adapter";

describe("AllowAllAuthorizationAdapter", () => {
  it("returns true for any principal/action/resource combination", async () => {
    const adapter = new AllowAllAuthorizationAdapter("development");

    const result = await adapter.can(
      { id: "user-123", roles: ["platform_operator"] },
      "view_audit_log",
      { type: "namespace", id: "aircraft-photos" },
    );

    expect(result).toBe(true);
  });

  it("throws when constructed with environment 'production'", () => {
    expect(() => new AllowAllAuthorizationAdapter("production")).toThrow(/AllowAll.*production/i);
  });

  it("does not throw for non-production environments", () => {
    expect(() => new AllowAllAuthorizationAdapter("development")).not.toThrow();
    expect(() => new AllowAllAuthorizationAdapter("test")).not.toThrow();
    expect(() => new AllowAllAuthorizationAdapter("staging")).not.toThrow();
  });
});
