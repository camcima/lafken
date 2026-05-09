import { beforeEach, describe, expect, it } from "vitest";

import { AllowAllAuthorizationAdapter } from "@/shared/infrastructure/authorization/allow-all-authorization.adapter";
import { LAFKEN_METRIC_NAMES } from "@/shared/infrastructure/telemetry/metrics";

import {
  findCounterPoint,
  type IMetricReaderHandle,
  installInMemoryMetricReader,
} from "../../../../__mocks__/in-memory-metric-reader";

describe("AllowAllAuthorizationAdapter — metrics emission", () => {
  let handle: IMetricReaderHandle;

  beforeEach(() => {
    handle = installInMemoryMetricReader();
    handle.reset();
  });

  it("emits lafken.authz.decision { action, result: 'allow' } on a successful can() call", async () => {
    const adapter = new AllowAllAuthorizationAdapter("development");

    await adapter.can({ id: "u1", roles: [] }, "view_audit_log", {
      type: "asset",
      id: "ns-test/a1",
    });

    await handle.forceFlush();

    expect(
      findCounterPoint(handle.exporter, LAFKEN_METRIC_NAMES.AUTHZ_DECISION, {
        action: "view_audit_log",
        result: "allow",
      })?.value,
    ).toBe(1);
  });
});
