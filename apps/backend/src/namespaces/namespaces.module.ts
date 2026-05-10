import { Module } from "@nestjs/common";

import { AuditInfrastructureModule } from "@/audit/infrastructure/audit-infrastructure.module";
import { DatabaseModule } from "@/shared/infrastructure/persistence/database.module";

import { ArchiveNamespaceUseCase } from "./application/use-cases/archive-namespace.use-case";
import { CreateNamespaceUseCase } from "./application/use-cases/create-namespace.use-case";
import { CreatePresetUseCase } from "./application/use-cases/create-preset.use-case";
import { GetNamespaceBySlugUseCase } from "./application/use-cases/get-namespace-by-slug.use-case";
import { ListNamespacePoliciesUseCase } from "./application/use-cases/list-namespace-policies.use-case";
import { ListNamespacePresetsUseCase } from "./application/use-cases/list-namespace-presets.use-case";
import { ListNamespacesUseCase } from "./application/use-cases/list-namespaces.use-case";
import { SetPresetActiveUseCase } from "./application/use-cases/set-preset-active.use-case";
import { UnarchiveNamespaceUseCase } from "./application/use-cases/unarchive-namespace.use-case";
import { UpdateNamespaceMetadataUseCase } from "./application/use-cases/update-namespace-metadata.use-case";
import { UpdateNamespacePolicyUseCase } from "./application/use-cases/update-namespace-policy.use-case";
import { UpdatePresetVersionUseCase } from "./application/use-cases/update-preset-version.use-case";
import { NamespacesInfrastructureModule } from "./infrastructure/namespaces-infrastructure.module";
import { NamespacesController } from "./presentation/controllers/namespaces.controller";

@Module({
  imports: [DatabaseModule, NamespacesInfrastructureModule, AuditInfrastructureModule],
  controllers: [NamespacesController],
  providers: [
    ListNamespacesUseCase,
    GetNamespaceBySlugUseCase,
    ListNamespacePoliciesUseCase,
    ListNamespacePresetsUseCase,
    CreateNamespaceUseCase,
    UpdateNamespaceMetadataUseCase,
    ArchiveNamespaceUseCase,
    UnarchiveNamespaceUseCase,
    UpdateNamespacePolicyUseCase,
    CreatePresetUseCase,
    UpdatePresetVersionUseCase,
    SetPresetActiveUseCase,
  ],
})
export class NamespacesModule {}
