import { Module } from "@nestjs/common";

import { GetNamespaceBySlugUseCase } from "./application/use-cases/get-namespace-by-slug.use-case";
import { ListNamespacePoliciesUseCase } from "./application/use-cases/list-namespace-policies.use-case";
import { ListNamespacePresetsUseCase } from "./application/use-cases/list-namespace-presets.use-case";
import { ListNamespacesUseCase } from "./application/use-cases/list-namespaces.use-case";
import { NamespacesInfrastructureModule } from "./infrastructure/namespaces-infrastructure.module";
import { NamespacesController } from "./presentation/controllers/namespaces.controller";

@Module({
  imports: [NamespacesInfrastructureModule],
  controllers: [NamespacesController],
  providers: [
    ListNamespacesUseCase,
    GetNamespaceBySlugUseCase,
    ListNamespacePoliciesUseCase,
    ListNamespacePresetsUseCase,
  ],
})
export class NamespacesModule {}
