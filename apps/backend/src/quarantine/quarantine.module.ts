import { Module } from "@nestjs/common";

import { ListQuarantinedAssetsUseCase } from "./application/use-cases/list-quarantined-assets.use-case";
import { QuarantineInfrastructureModule } from "./infrastructure/quarantine-infrastructure.module";
import { QuarantineController } from "./presentation/controllers/quarantine.controller";

@Module({
  imports: [QuarantineInfrastructureModule],
  controllers: [QuarantineController],
  providers: [ListQuarantinedAssetsUseCase],
})
export class QuarantineModule {}
