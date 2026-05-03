import { Module } from "@nestjs/common";

import { NamespaceQueryRepositoryPort } from "@/namespaces/domain/repositories/namespace-query.repository.port";
import { DatabaseModule } from "@/shared/infrastructure/persistence/database.module";

import { NamespaceQueryRepository } from "./persistence/repositories/namespace-query.repository";

@Module({
  imports: [DatabaseModule],
  providers: [
    NamespaceQueryRepository,
    { provide: NamespaceQueryRepositoryPort, useExisting: NamespaceQueryRepository },
  ],
  exports: [NamespaceQueryRepositoryPort],
})
export class NamespacesInfrastructureModule {}
