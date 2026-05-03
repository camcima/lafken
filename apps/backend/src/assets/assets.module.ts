import { Module } from "@nestjs/common";

import { GetAssetByPublicIdUseCase } from "./application/use-cases/get-asset-by-public-id.use-case";
import { GetAssetProcessingJobUseCase } from "./application/use-cases/get-asset-processing-job.use-case";
import { ListAssetAnalysesUseCase } from "./application/use-cases/list-asset-analyses.use-case";
import { ListAssetStateTransitionsUseCase } from "./application/use-cases/list-asset-state-transitions.use-case";
import { ListAssetsUseCase } from "./application/use-cases/list-assets.use-case";
import { AssetsInfrastructureModule } from "./infrastructure/assets-infrastructure.module";
import { AssetsController } from "./presentation/controllers/assets.controller";

@Module({
  imports: [AssetsInfrastructureModule],
  controllers: [AssetsController],
  providers: [
    ListAssetsUseCase,
    GetAssetByPublicIdUseCase,
    ListAssetStateTransitionsUseCase,
    ListAssetAnalysesUseCase,
    GetAssetProcessingJobUseCase,
  ],
})
export class AssetsModule {}
