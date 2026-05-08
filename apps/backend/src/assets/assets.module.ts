import { Module } from "@nestjs/common";

import { NamespacesInfrastructureModule } from "@/namespaces/infrastructure/namespaces-infrastructure.module";
import { SystemInfrastructureModule } from "@/system/infrastructure/system-infrastructure.module";

import { ConfirmUploadUseCase } from "./application/use-cases/confirm-upload.use-case";
import { CreateUploadIntentUseCase } from "./application/use-cases/create-upload-intent.use-case";
import { GetAssetByIdUseCase } from "./application/use-cases/get-asset-by-id.use-case";
import { GetAssetByPublicIdUseCase } from "./application/use-cases/get-asset-by-public-id.use-case";
import { GetAssetDownloadUrlUseCase } from "./application/use-cases/get-asset-download-url.use-case";
import { GetAssetProcessingJobUseCase } from "./application/use-cases/get-asset-processing-job.use-case";
import { ListAssetAnalysesUseCase } from "./application/use-cases/list-asset-analyses.use-case";
import { ListAssetStateTransitionsUseCase } from "./application/use-cases/list-asset-state-transitions.use-case";
import { ListAssetsUseCase } from "./application/use-cases/list-assets.use-case";
import { RetryAssetProcessingUseCase } from "./application/use-cases/retry-asset-processing.use-case";
import { AssetsInfrastructureModule } from "./infrastructure/assets-infrastructure.module";
import { AssetsController } from "./presentation/controllers/assets.controller";

@Module({
  imports: [AssetsInfrastructureModule, NamespacesInfrastructureModule, SystemInfrastructureModule],
  controllers: [AssetsController],
  providers: [
    ListAssetsUseCase,
    GetAssetByIdUseCase,
    GetAssetByPublicIdUseCase,
    ListAssetStateTransitionsUseCase,
    ListAssetAnalysesUseCase,
    GetAssetProcessingJobUseCase,
    CreateUploadIntentUseCase,
    ConfirmUploadUseCase,
    RetryAssetProcessingUseCase,
    GetAssetDownloadUrlUseCase,
  ],
})
export class AssetsModule {}
