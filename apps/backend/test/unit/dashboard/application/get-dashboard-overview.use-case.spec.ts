import { beforeEach, describe, expect, it } from "vitest";

import { GetDashboardOverviewUseCase } from "@/dashboard/application/use-cases/get-dashboard-overview.use-case";
import type { IDashboardCounts } from "@/dashboard/domain/types/dashboard-counts.types";
import type { ISystemHealthSnapshot } from "@/system/domain/services/system-health-reader.service.port";

import { InMemoryDashboardCountsRepository } from "../__fakes__/in-memory-dashboard-counts.repository";
import { StaticSystemHealthReaderAdapter } from "../__fakes__/static-system-health-reader.adapter";

describe("GetDashboardOverviewUseCase", () => {
  let countsRepo: InMemoryDashboardCountsRepository;
  let healthReader: StaticSystemHealthReaderAdapter;
  let useCase: GetDashboardOverviewUseCase;

  beforeEach(() => {
    countsRepo = new InMemoryDashboardCountsRepository();
    healthReader = new StaticSystemHealthReaderAdapter();
    useCase = new GetDashboardOverviewUseCase(countsRepo, healthReader);
  });

  it("returns all-zero counts and ok health when repositories are empty", async () => {
    const result = await useCase.execute();

    expect(result.counts).toEqual({
      totalAssets: 0,
      inFlight: 0,
      queueDepth: 0,
      quarantine: 0,
      legalHolds: 0,
      failedProcessing: 0,
    });
    expect(result.health.overall).toBe("ok");
  });

  it("combines seeded counts with the health snapshot", async () => {
    const seedCounts: IDashboardCounts = {
      totalAssets: 42,
      inFlight: 5,
      queueDepth: 3,
      quarantine: 2,
      legalHolds: 1,
      failedProcessing: 4,
    };
    countsRepo.seed(seedCounts);

    const result = await useCase.execute();

    expect(result.counts).toEqual(seedCounts);
  });

  it("reflects a degraded health snapshot from the reader", async () => {
    const degradedSnapshot: ISystemHealthSnapshot = {
      overall: "degraded",
      indicators: [{ name: "database", status: "degraded", detail: "high latency" }],
      integrations: [],
    };
    healthReader.seed(degradedSnapshot);

    const result = await useCase.execute();

    expect(result.health.overall).toBe("degraded");
    expect(result.health.indicators[0].detail).toBe("high latency");
  });
});
