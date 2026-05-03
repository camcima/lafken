import { Module } from "@nestjs/common";

import { AssetQueryRepositoryPort } from "@/assets/domain/repositories/asset-query.repository.port";
import { DatabaseModule } from "@/shared/infrastructure/persistence/database.module";

import { AssetQueryRepository } from "./persistence/repositories/asset-query.repository";

@Module({
  imports: [DatabaseModule],
  providers: [
    AssetQueryRepository,
    { provide: AssetQueryRepositoryPort, useExisting: AssetQueryRepository },
  ],
  exports: [AssetQueryRepositoryPort],
})
export class AssetsInfrastructureModule {}
