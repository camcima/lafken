import { describe, expect, it } from "vitest";

import type {
  AuditAction,
  AuditEntityType,
} from "@/audit/domain/repositories/audit-write.repository.port";

describe("audit type unions", () => {
  it("supports upload_intent entity and expired/url_refreshed actions", () => {
    // Type-only assertions — compile-time wins are the value here. A runtime
    // check keeps the suite from being a no-op when the unions later change.
    const entity: AuditEntityType = "upload_intent";
    const expired: AuditAction = "expired";
    const refreshed: AuditAction = "url_refreshed";
    expect([entity, expired, refreshed]).toEqual(["upload_intent", "expired", "url_refreshed"]);
  });
});
