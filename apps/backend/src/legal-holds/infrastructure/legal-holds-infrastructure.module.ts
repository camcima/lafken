import { Module } from "@nestjs/common";

import { LegalHoldQueryRepositoryPort } from "@/legal-holds/domain/repositories/legal-hold-query.repository.port";
import { DatabaseModule } from "@/shared/infrastructure/persistence/database.module";

import { LegalHoldQueryRepository } from "./persistence/repositories/legal-hold-query.repository";

@Module({
  imports: [DatabaseModule],
  providers: [
    LegalHoldQueryRepository,
    { provide: LegalHoldQueryRepositoryPort, useExisting: LegalHoldQueryRepository },
  ],
  exports: [LegalHoldQueryRepositoryPort],
})
export class LegalHoldsInfrastructureModule {}
