import { Module } from "@nestjs/common";

import { AssetsInfrastructureModule } from "@/assets/infrastructure/assets-infrastructure.module";
import { LegalHoldQueryRepositoryPort } from "@/legal-holds/domain/repositories/legal-hold-query.repository.port";
import { LegalHoldWriteRepositoryPort } from "@/legal-holds/domain/repositories/legal-hold-write.repository.port";
import { DatabaseModule } from "@/shared/infrastructure/persistence/database.module";

import { LegalHoldQueryRepository } from "./persistence/repositories/legal-hold-query.repository";
import { LegalHoldWriteRepository } from "./persistence/repositories/legal-hold-write.repository";

@Module({
  imports: [DatabaseModule, AssetsInfrastructureModule],
  providers: [
    LegalHoldQueryRepository,
    LegalHoldWriteRepository,
    { provide: LegalHoldQueryRepositoryPort, useExisting: LegalHoldQueryRepository },
    { provide: LegalHoldWriteRepositoryPort, useExisting: LegalHoldWriteRepository },
  ],
  exports: [LegalHoldQueryRepositoryPort, LegalHoldWriteRepositoryPort, AssetsInfrastructureModule],
})
export class LegalHoldsInfrastructureModule {}
