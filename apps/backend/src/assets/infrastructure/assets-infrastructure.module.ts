import { Module } from "@nestjs/common";

import { AssetProcessingRepositoryPort } from "@/assets/domain/repositories/asset-processing.repository.port";
import { AssetQueryRepositoryPort } from "@/assets/domain/repositories/asset-query.repository.port";
import { AssetWriteRepositoryPort } from "@/assets/domain/repositories/asset-write.repository.port";
import { ProcessingJobRepositoryPort } from "@/assets/domain/repositories/processing-job.repository.port";
import { UploadIntentWriteRepositoryPort } from "@/assets/domain/repositories/upload-intent-write.repository.port";
import { AssetStoragePort } from "@/assets/domain/services/asset-storage.service.port";
import { ContentModerationPort } from "@/assets/domain/services/content-moderation.service.port";
import { ImageInspectionPort } from "@/assets/domain/services/image-inspection.service.port";
import { PreviewUrlSignerPort } from "@/assets/domain/services/preview-url-signer.port";
import { VirusScanPort } from "@/assets/domain/services/virus-scan.service.port";
import { environmentConfiguration } from "@/shared/infrastructure/environment.configuration";
import { DatabaseModule } from "@/shared/infrastructure/persistence/database.module";

import { AssetProcessingRepository } from "./persistence/repositories/asset-processing.repository";
import { AssetQueryRepository } from "./persistence/repositories/asset-query.repository";
import { AssetWriteRepository } from "./persistence/repositories/asset-write.repository";
import { ProcessingJobRepository } from "./persistence/repositories/processing-job.repository";
import { UploadIntentWriteRepository } from "./persistence/repositories/upload-intent-write.repository";
import { GcsAssetStorageAdapter } from "./services/gcs-asset-storage.adapter";
import { ImgproxyPreviewUrlSigner } from "./services/imgproxy-preview-url-signer.adapter";
import { LocalContentModerationAdapter } from "./services/local-content-moderation.adapter";
import { LocalVirusScanAdapter } from "./services/local-virus-scan.adapter";
import { NoopPreviewUrlSigner } from "./services/noop-preview-url-signer.adapter";
import { SharpImageInspectionAdapter } from "./services/sharp-image-inspection.adapter";

@Module({
  imports: [DatabaseModule],
  providers: [
    AssetQueryRepository,
    { provide: AssetQueryRepositoryPort, useExisting: AssetQueryRepository },
    AssetProcessingRepository,
    { provide: AssetProcessingRepositoryPort, useExisting: AssetProcessingRepository },
    AssetWriteRepository,
    { provide: AssetWriteRepositoryPort, useExisting: AssetWriteRepository },
    ProcessingJobRepository,
    { provide: ProcessingJobRepositoryPort, useExisting: ProcessingJobRepository },
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
    { provide: ImageInspectionPort, useClass: SharpImageInspectionAdapter },
    { provide: VirusScanPort, useClass: LocalVirusScanAdapter },
    { provide: ContentModerationPort, useClass: LocalContentModerationAdapter },
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
    AssetProcessingRepositoryPort,
    AssetWriteRepositoryPort,
    ProcessingJobRepositoryPort,
    UploadIntentWriteRepositoryPort,
    AssetStoragePort,
    ImageInspectionPort,
    VirusScanPort,
    ContentModerationPort,
    PreviewUrlSignerPort,
  ],
})
export class AssetsInfrastructureModule {}
