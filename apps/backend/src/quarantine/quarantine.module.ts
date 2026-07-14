import { Module } from "@nestjs/common";

import { AssetsInfrastructureModule } from "@/assets/infrastructure/assets-infrastructure.module";
import { AuditInfrastructureModule } from "@/audit/infrastructure/audit-infrastructure.module";
import { DatabaseModule } from "@/shared/infrastructure/persistence/database.module";
import { SystemInfrastructureModule } from "@/system/infrastructure/system-infrastructure.module";

import { ListQuarantinedAssetsUseCase } from "./application/use-cases/list-quarantined-assets.use-case";
import { RejectQuarantinedAssetUseCase } from "./application/use-cases/reject-quarantined-asset.use-case";
import { ReleaseQuarantinedAssetUseCase } from "./application/use-cases/release-quarantined-asset.use-case";
import { QuarantineInfrastructureModule } from "./infrastructure/quarantine-infrastructure.module";
import { QuarantineController } from "./presentation/controllers/quarantine.controller";

@Module({
  imports: [
    QuarantineInfrastructureModule,
    AssetsInfrastructureModule,
    SystemInfrastructureModule,
    AuditInfrastructureModule,
    DatabaseModule,
  ],
  controllers: [QuarantineController],
  providers: [
    ListQuarantinedAssetsUseCase,
    ReleaseQuarantinedAssetUseCase,
    RejectQuarantinedAssetUseCase,
  ],
})
export class QuarantineModule {}
