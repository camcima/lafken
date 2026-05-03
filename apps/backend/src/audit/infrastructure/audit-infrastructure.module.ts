import { Module } from "@nestjs/common";

import { AuditQueryRepositoryPort } from "@/audit/domain/repositories/audit-query.repository.port";
import { DatabaseModule } from "@/shared/infrastructure/persistence/database.module";

import { AuditQueryRepository } from "./persistence/repositories/audit-query.repository";

@Module({
  imports: [DatabaseModule],
  providers: [
    AuditQueryRepository,
    { provide: AuditQueryRepositoryPort, useExisting: AuditQueryRepository },
  ],
  exports: [AuditQueryRepositoryPort],
})
export class AuditInfrastructureModule {}
