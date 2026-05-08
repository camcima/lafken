import { Module } from "@nestjs/common";

import { AuditQueryRepositoryPort } from "@/audit/domain/repositories/audit-query.repository.port";
import { AuditWriteRepositoryPort } from "@/audit/domain/repositories/audit-write.repository.port";
import { LoggerModule } from "@/shared/infrastructure/logger/logger.module";
import { DatabaseModule } from "@/shared/infrastructure/persistence/database.module";

import { AuditQueryRepository } from "./persistence/repositories/audit-query.repository";
import { AuditWriteRepository } from "./persistence/repositories/audit-write.repository";

@Module({
  imports: [DatabaseModule, LoggerModule],
  providers: [
    AuditQueryRepository,
    { provide: AuditQueryRepositoryPort, useExisting: AuditQueryRepository },
    AuditWriteRepository,
    { provide: AuditWriteRepositoryPort, useExisting: AuditWriteRepository },
  ],
  exports: [AuditQueryRepositoryPort, AuditWriteRepositoryPort],
})
export class AuditInfrastructureModule {}
