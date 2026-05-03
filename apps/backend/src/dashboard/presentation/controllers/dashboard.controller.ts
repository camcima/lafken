import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { DashboardOverviewResponseDTO } from "@shared/backend-api";

import { GetDashboardOverviewUseCase } from "@/dashboard/application/use-cases/get-dashboard-overview.use-case";
import { AuthenticatedEndpoint } from "@/shared/presentation/auth/decorators/authenticated-endpoint.decorator";

import { DashboardOverviewResponseMapper } from "../mappers/dashboard-overview.response-mapper";

@Controller({ path: "dashboard" })
@ApiTags("Dashboard")
export class DashboardController {
  constructor(private readonly getDashboardOverviewUseCase: GetDashboardOverviewUseCase) {}

  @Get("overview")
  @AuthenticatedEndpoint()
  @ApiOperation({ summary: "Dashboard overview — counts and system health snapshot" })
  @ApiOkResponse({ type: DashboardOverviewResponseDTO })
  async getOverview(): Promise<DashboardOverviewResponseDTO> {
    const overview = await this.getDashboardOverviewUseCase.execute();
    return DashboardOverviewResponseMapper.fromDomain(overview);
  }
}
