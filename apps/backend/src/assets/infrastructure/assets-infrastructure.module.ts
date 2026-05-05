import { Module } from "@nestjs/common";

import { AssetQueryRepositoryPort } from "@/assets/domain/repositories/asset-query.repository.port";
import { AssetWriteRepositoryPort } from "@/assets/domain/repositories/asset-write.repository.port";
import { UploadIntentWriteRepositoryPort } from "@/assets/domain/repositories/upload-intent-write.repository.port";
import { AssetStoragePort } from "@/assets/domain/services/asset-storage.service.port";
import { environmentConfiguration } from "@/shared/infrastructure/environment.configuration";
import { DatabaseModule } from "@/shared/infrastructure/persistence/database.module";

import { AssetQueryRepository } from "./persistence/repositories/asset-query.repository";
import { AssetWriteRepository } from "./persistence/repositories/asset-write.repository";
import { UploadIntentWriteRepository } from "./persistence/repositories/upload-intent-write.repository";
import { GcsAssetStorageAdapter } from "./services/gcs-asset-storage.adapter";

@Module({
  imports: [DatabaseModule],
  providers: [
    AssetQueryRepository,
    { provide: AssetQueryRepositoryPort, useExisting: AssetQueryRepository },
    AssetWriteRepository,
    { provide: AssetWriteRepositoryPort, useExisting: AssetWriteRepository },
    UploadIntentWriteRepository,
    { provide: UploadIntentWriteRepositoryPort, useExisting: UploadIntentWriteRepository },
    {
      provide: AssetStoragePort,
      useFactory: (): AssetStoragePort =>
        new GcsAssetStorageAdapter({
          endpoint: environmentConfiguration.STORAGE_GCS_ENDPOINT,
          credentialsJson: environmentConfiguration.GCS_SERVICE_ACCOUNT_JSON,
        }),
    },
  ],
  exports: [
    AssetQueryRepositoryPort,
    AssetWriteRepositoryPort,
    UploadIntentWriteRepositoryPort,
    AssetStoragePort,
  ],
})
export class AssetsInfrastructureModule {}
