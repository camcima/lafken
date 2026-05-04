import { Module } from "@nestjs/common";

import { CreateStorageBindingUseCase } from "./application/use-cases/create-storage-binding.use-case";
import { DeleteStorageBindingUseCase } from "./application/use-cases/delete-storage-binding.use-case";
import { GetStorageBindingByNameUseCase } from "./application/use-cases/get-storage-binding-by-name.use-case";
import { GetSystemHealthUseCase } from "./application/use-cases/get-system-health.use-case";
import { ListIntegrationsUseCase } from "./application/use-cases/list-integrations.use-case";
import { ListStorageBindingsUseCase } from "./application/use-cases/list-storage-bindings.use-case";
import { UpdateStorageBindingUseCase } from "./application/use-cases/update-storage-binding.use-case";
import { SystemInfrastructureModule } from "./infrastructure/system-infrastructure.module";
import { SystemController } from "./presentation/controllers/system.controller";

@Module({
  imports: [SystemInfrastructureModule],
  controllers: [SystemController],
  providers: [
    ListStorageBindingsUseCase,
    GetStorageBindingByNameUseCase,
    CreateStorageBindingUseCase,
    UpdateStorageBindingUseCase,
    DeleteStorageBindingUseCase,
    ListIntegrationsUseCase,
    GetSystemHealthUseCase,
  ],
})
export class SystemModule {}
