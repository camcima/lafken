import { Module } from "@nestjs/common";

import { AuditInfrastructureModule } from "@/audit/infrastructure/audit-infrastructure.module";
import { NamespacesInfrastructureModule } from "@/namespaces/infrastructure/namespaces-infrastructure.module";
import { DatabaseModule } from "@/shared/infrastructure/persistence/database.module";
import { TelemetryModule } from "@/shared/infrastructure/telemetry/telemetry.module";
import { SystemInfrastructureModule } from "@/system/infrastructure/system-infrastructure.module";

import { ConfirmUploadUseCase } from "./application/use-cases/confirm-upload.use-case";
import { CreateUploadIntentUseCase } from "./application/use-cases/create-upload-intent.use-case";
import { DeleteAssetUseCase } from "./application/use-cases/delete-asset.use-case";
import { GetAssetByIdUseCase } from "./application/use-cases/get-asset-by-id.use-case";
import { GetAssetByPublicIdUseCase } from "./application/use-cases/get-asset-by-public-id.use-case";
import { GetAssetDownloadUrlUseCase } from "./application/use-cases/get-asset-download-url.use-case";
import { GetAssetProcessingJobUseCase } from "./application/use-cases/get-asset-processing-job.use-case";
import { GetPreviewUrlUseCase } from "./application/use-cases/get-preview-url.use-case";
import { ListAssetAnalysesUseCase } from "./application/use-cases/list-asset-analyses.use-case";
import { ListAssetStateTransitionsUseCase } from "./application/use-cases/list-asset-state-transitions.use-case";
import { ListAssetsUseCase } from "./application/use-cases/list-assets.use-case";
import { RefreshUploadUrlUseCase } from "./application/use-cases/refresh-upload-url.use-case";
import { RetryAssetProcessingUseCase } from "./application/use-cases/retry-asset-processing.use-case";
import { AssetsInfrastructureModule } from "./infrastructure/assets-infrastructure.module";
import { AssetsController } from "./presentation/controllers/assets.controller";

@Module({
  imports: [
    DatabaseModule,
    TelemetryModule,
    AssetsInfrastructureModule,
    NamespacesInfrastructureModule,
    SystemInfrastructureModule,
    AuditInfrastructureModule,
  ],
  controllers: [AssetsController],
  providers: [
    ListAssetsUseCase,
    GetAssetByIdUseCase,
    GetAssetByPublicIdUseCase,
    ListAssetStateTransitionsUseCase,
    ListAssetAnalysesUseCase,
    GetAssetProcessingJobUseCase,
    GetPreviewUrlUseCase,
    CreateUploadIntentUseCase,
    DeleteAssetUseCase,
    ConfirmUploadUseCase,
    RetryAssetProcessingUseCase,
    GetAssetDownloadUrlUseCase,
    RefreshUploadUrlUseCase,
  ],
})
export class AssetsModule {}
