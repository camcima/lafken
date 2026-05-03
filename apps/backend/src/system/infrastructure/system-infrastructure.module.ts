import { Module } from "@nestjs/common";

import { DatabaseModule } from "@/shared/infrastructure/persistence/database.module";
import { StorageBindingQueryRepositoryPort } from "@/system/domain/repositories/storage-binding-query.repository.port";
import { IntegrationStatusReader } from "@/system/domain/services/integration-status-reader.service.port";
import { SystemHealthReader } from "@/system/domain/services/system-health-reader.service.port";

import { StorageBindingQueryRepository } from "./persistence/repositories/storage-binding-query.repository";
import { DatabaseSystemHealthAdapter } from "./services/database-system-health.adapter";
import { EnvironmentIntegrationStatusAdapter } from "./services/environment-integration-status.adapter";

@Module({
  imports: [DatabaseModule],
  providers: [
    StorageBindingQueryRepository,
    { provide: StorageBindingQueryRepositoryPort, useExisting: StorageBindingQueryRepository },
    EnvironmentIntegrationStatusAdapter,
    { provide: IntegrationStatusReader, useExisting: EnvironmentIntegrationStatusAdapter },
    DatabaseSystemHealthAdapter,
    { provide: SystemHealthReader, useExisting: DatabaseSystemHealthAdapter },
  ],
  exports: [StorageBindingQueryRepositoryPort, IntegrationStatusReader, SystemHealthReader],
})
export class SystemInfrastructureModule {}
