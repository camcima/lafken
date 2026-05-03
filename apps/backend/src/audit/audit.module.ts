import { Module } from "@nestjs/common";

import { ListAuditEntriesUseCase } from "./application/use-cases/list-audit-entries.use-case";
import { AuditInfrastructureModule } from "./infrastructure/audit-infrastructure.module";
import { AuditController } from "./presentation/controllers/audit.controller";

@Module({
  imports: [AuditInfrastructureModule],
  controllers: [AuditController],
  providers: [ListAuditEntriesUseCase],
})
export class AuditModule {}
