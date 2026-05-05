import { Module } from "@nestjs/common";

import { AssetQueryRepositoryPort } from "@/assets/domain/repositories/asset-query.repository.port";
import { AssetWriteRepositoryPort } from "@/assets/domain/repositories/asset-write.repository.port";
import { UploadIntentWriteRepositoryPort } from "@/assets/domain/repositories/upload-intent-write.repository.port";
import { DatabaseModule } from "@/shared/infrastructure/persistence/database.module";

import { AssetQueryRepository } from "./persistence/repositories/asset-query.repository";
import { AssetWriteRepository } from "./persistence/repositories/asset-write.repository";
import { UploadIntentWriteRepository } from "./persistence/repositories/upload-intent-write.repository";

@Module({
  imports: [DatabaseModule],
  providers: [
    AssetQueryRepository,
    { provide: AssetQueryRepositoryPort, useExisting: AssetQueryRepository },
    AssetWriteRepository,
    { provide: AssetWriteRepositoryPort, useExisting: AssetWriteRepository },
    UploadIntentWriteRepository,
    { provide: UploadIntentWriteRepositoryPort, useExisting: UploadIntentWriteRepository },
  ],
  exports: [AssetQueryRepositoryPort, AssetWriteRepositoryPort, UploadIntentWriteRepositoryPort],
})
export class AssetsInfrastructureModule {}
