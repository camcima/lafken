import { Module } from "@nestjs/common";

import { SystemInfrastructureModule } from "@/system/infrastructure/system-infrastructure.module";

import { GetDashboardOverviewUseCase } from "./application/use-cases/get-dashboard-overview.use-case";
import { DashboardInfrastructureModule } from "./infrastructure/dashboard-infrastructure.module";
import { DashboardController } from "./presentation/controllers/dashboard.controller";

@Module({
  imports: [DashboardInfrastructureModule, SystemInfrastructureModule],
  controllers: [DashboardController],
  providers: [GetDashboardOverviewUseCase],
})
export class DashboardModule {}
