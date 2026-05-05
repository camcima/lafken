import { Module } from "@nestjs/common";

import { AssetQueryRepositoryPort } from "@/assets/domain/repositories/asset-query.repository.port";
import { AssetWriteRepositoryPort } from "@/assets/domain/repositories/asset-write.repository.port";
import { UploadIntentWriteRepositoryPort } from "@/assets/domain/repositories/upload-intent-write.repository.port";
import { AssetStoragePort } from "@/assets/domain/services/asset-storage.service.port";
import { PreviewUrlSignerPort } from "@/assets/domain/services/preview-url-signer.port";
import { environmentConfiguration } from "@/shared/infrastructure/environment.configuration";
import { DatabaseModule } from "@/shared/infrastructure/persistence/database.module";

import { AssetQueryRepository } from "./persistence/repositories/asset-query.repository";
import { AssetWriteRepository } from "./persistence/repositories/asset-write.repository";
import { UploadIntentWriteRepository } from "./persistence/repositories/upload-intent-write.repository";
import { GcsAssetStorageAdapter } from "./services/gcs-asset-storage.adapter";
import { ImgproxyPreviewUrlSigner } from "./services/imgproxy-preview-url-signer.adapter";
import { NoopPreviewUrlSigner } from "./services/noop-preview-url-signer.adapter";

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
    {
      provide: PreviewUrlSignerPort,
      useFactory: (): PreviewUrlSignerPort => {
        const baseUrl: string | undefined = environmentConfiguration.IMGPROXY_BASE_URL;
        const keyHex: string | undefined = environmentConfiguration.IMGPROXY_KEY;
        const saltHex: string | undefined = environmentConfiguration.IMGPROXY_SALT;
        if (!baseUrl || !keyHex || !saltHex) {
          return new NoopPreviewUrlSigner();
        }
        return new ImgproxyPreviewUrlSigner({
          baseUrl,
          keyHex,
          saltHex,
          signatureSize: environmentConfiguration.IMGPROXY_SIGNATURE_SIZE,
        });
      },
    },
  ],
  exports: [
    AssetQueryRepositoryPort,
    AssetWriteRepositoryPort,
    UploadIntentWriteRepositoryPort,
    AssetStoragePort,
    PreviewUrlSignerPort,
  ],
})
export class AssetsInfrastructureModule {}
