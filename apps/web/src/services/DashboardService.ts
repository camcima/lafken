import type { DashboardOverviewResponseDTO } from "@shared/backend-api";

import { BaseService } from "./BaseService";

export class DashboardService extends BaseService {
  private readonly basePath = "/dashboard";

  async getOverview(): Promise<DashboardOverviewResponseDTO> {
    return this.getApiClient().get<DashboardOverviewResponseDTO>(
      this.getServiceUrl(`${this.basePath}/overview`),
    );
  }
}
