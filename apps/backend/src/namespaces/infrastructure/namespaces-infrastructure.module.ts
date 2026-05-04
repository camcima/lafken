import { Module } from "@nestjs/common";

import { NamespaceQueryRepositoryPort } from "@/namespaces/domain/repositories/namespace-query.repository.port";
import { NamespaceWriteRepositoryPort } from "@/namespaces/domain/repositories/namespace-write.repository.port";
import { DatabaseModule } from "@/shared/infrastructure/persistence/database.module";

import { NamespaceQueryRepository } from "./persistence/repositories/namespace-query.repository";
import { NamespaceWriteRepository } from "./persistence/repositories/namespace-write.repository";

@Module({
  imports: [DatabaseModule],
  providers: [
    NamespaceQueryRepository,
    { provide: NamespaceQueryRepositoryPort, useExisting: NamespaceQueryRepository },
    NamespaceWriteRepository,
    { provide: NamespaceWriteRepositoryPort, useExisting: NamespaceWriteRepository },
  ],
  exports: [NamespaceQueryRepositoryPort, NamespaceWriteRepositoryPort],
})
export class NamespacesInfrastructureModule {}
