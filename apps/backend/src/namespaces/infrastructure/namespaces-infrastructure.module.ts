import { Module } from "@nestjs/common";

import { NamespacePresetWriteRepositoryPort } from "@/namespaces/domain/repositories/namespace-preset-write.repository.port";
import { NamespaceQueryRepositoryPort } from "@/namespaces/domain/repositories/namespace-query.repository.port";
import { NamespaceWriteRepositoryPort } from "@/namespaces/domain/repositories/namespace-write.repository.port";
import { DatabaseModule } from "@/shared/infrastructure/persistence/database.module";

import { NamespacePresetWriteRepository } from "./persistence/repositories/namespace-preset-write.repository";
import { NamespaceQueryRepository } from "./persistence/repositories/namespace-query.repository";
import { NamespaceWriteRepository } from "./persistence/repositories/namespace-write.repository";

@Module({
  imports: [DatabaseModule],
  providers: [
    NamespaceQueryRepository,
    { provide: NamespaceQueryRepositoryPort, useExisting: NamespaceQueryRepository },
    NamespaceWriteRepository,
    { provide: NamespaceWriteRepositoryPort, useExisting: NamespaceWriteRepository },
    NamespacePresetWriteRepository,
    { provide: NamespacePresetWriteRepositoryPort, useExisting: NamespacePresetWriteRepository },
  ],
  exports: [NamespaceQueryRepositoryPort, NamespaceWriteRepositoryPort, NamespacePresetWriteRepositoryPort],
})
export class NamespacesInfrastructureModule {}
