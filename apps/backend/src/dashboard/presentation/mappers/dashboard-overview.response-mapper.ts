import { DashboardOverviewResponseDTO } from "@shared/backend-api";

import type { IDashboardOverview } from "@/dashboard/application/use-cases/get-dashboard-overview.use-case";
import { SystemHealthResponseMapper } from "@/system/presentation/mappers/system-health.response-mapper";

export class DashboardOverviewResponseMapper {
  static fromDomain(overview: IDashboardOverview): DashboardOverviewResponseDTO {
    return {
      counts: { ...overview.counts },
      health: SystemHealthResponseMapper.fromDomain(overview.health),
    };
  }
}
