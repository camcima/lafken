import { describe, expect, it } from "vitest";

import type { IDashboardOverview } from "@/dashboard/application/use-cases/get-dashboard-overview.use-case";

import { DashboardOverviewResponseMapper } from "./dashboard-overview.response-mapper";

describe("DashboardOverviewResponseMapper", () => {
  const overview: IDashboardOverview = {
    counts: {
      totalAssets: 10,
      inFlight: 2,
      queueDepth: 1,
      quarantine: 3,
      legalHolds: 0,
      failedProcessing: 1,
    },
    health: {
      overall: "ok",
      indicators: [{ name: "database", status: "ok", detail: null }],
      integrations: [],
    },
  };

  it("maps counts fields directly", () => {
    const dto = DashboardOverviewResponseMapper.fromDomain(overview);
    expect(dto.counts.totalAssets).toBe(10);
    expect(dto.counts.inFlight).toBe(2);
    expect(dto.counts.queueDepth).toBe(1);
    expect(dto.counts.quarantine).toBe(3);
    expect(dto.counts.legalHolds).toBe(0);
    expect(dto.counts.failedProcessing).toBe(1);
  });

  it("maps health overall and indicators", () => {
    const dto = DashboardOverviewResponseMapper.fromDomain(overview);
    expect(dto.health.overall).toBe("ok");
    expect(dto.health.indicators).toHaveLength(1);
    expect(dto.health.indicators[0].name).toBe("database");
  });

  it("omits null detail from indicators", () => {
    const dto = DashboardOverviewResponseMapper.fromDomain(overview);
    expect(dto.health.indicators[0].detail).toBeUndefined();
  });
});
