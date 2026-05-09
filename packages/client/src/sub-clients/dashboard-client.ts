import type { DashboardOverviewResponseDTO } from "@shared/backend-api";

import type { Transport } from "../transport";

export class DashboardClient {
  constructor(private readonly t: Transport) {}

  getOverview(): Promise<DashboardOverviewResponseDTO> {
    return this.t.request<DashboardOverviewResponseDTO>("GET", "/v1/dashboard/overview");
  }
}
