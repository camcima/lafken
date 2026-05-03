import { Injectable } from "@nestjs/common";

import { DashboardCountsRepositoryPort } from "@/dashboard/domain/repositories/dashboard-counts.repository.port";
import type { IDashboardCounts } from "@/dashboard/domain/types/dashboard-counts.types";
import type { ISystemHealthSnapshot } from "@/system/domain/services/system-health-reader.service.port";
import { SystemHealthReader } from "@/system/domain/services/system-health-reader.service.port";

export interface IDashboardOverview {
  counts: IDashboardCounts;
  health: ISystemHealthSnapshot;
}

@Injectable()
export class GetDashboardOverviewUseCase {
  constructor(
    private readonly counts: DashboardCountsRepositoryPort,
    private readonly health: SystemHealthReader,
  ) {}

  async execute(): Promise<IDashboardOverview> {
    const [counts, health] = await Promise.all([this.counts.read(), this.health.read()]);
    return { counts, health };
  }
}
