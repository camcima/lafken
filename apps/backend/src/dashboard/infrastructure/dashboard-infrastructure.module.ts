import { Module } from "@nestjs/common";

import { DashboardCountsRepositoryPort } from "@/dashboard/domain/repositories/dashboard-counts.repository.port";
import { DatabaseModule } from "@/shared/infrastructure/persistence/database.module";

import { DashboardCountsRepository } from "./persistence/repositories/dashboard-counts.repository";

@Module({
  imports: [DatabaseModule],
  providers: [
    DashboardCountsRepository,
    { provide: DashboardCountsRepositoryPort, useExisting: DashboardCountsRepository },
  ],
  exports: [DashboardCountsRepositoryPort],
})
export class DashboardInfrastructureModule {}
