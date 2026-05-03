import { Module } from "@nestjs/common";

import { GetStorageBindingByNameUseCase } from "./application/use-cases/get-storage-binding-by-name.use-case";
import { GetSystemHealthUseCase } from "./application/use-cases/get-system-health.use-case";
import { ListIntegrationsUseCase } from "./application/use-cases/list-integrations.use-case";
import { ListStorageBindingsUseCase } from "./application/use-cases/list-storage-bindings.use-case";
import { SystemInfrastructureModule } from "./infrastructure/system-infrastructure.module";
import { SystemController } from "./presentation/controllers/system.controller";

@Module({
  imports: [SystemInfrastructureModule],
  controllers: [SystemController],
  providers: [
    ListStorageBindingsUseCase,
    GetStorageBindingByNameUseCase,
    ListIntegrationsUseCase,
    GetSystemHealthUseCase,
  ],
})
export class SystemModule {}
