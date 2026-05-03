import { Module } from "@nestjs/common";

import { QuarantineQueryRepositoryPort } from "@/quarantine/domain/repositories/quarantine-query.repository.port";
import { DatabaseModule } from "@/shared/infrastructure/persistence/database.module";

import { QuarantineQueryRepository } from "./persistence/repositories/quarantine-query.repository";

@Module({
  imports: [DatabaseModule],
  providers: [
    QuarantineQueryRepository,
    { provide: QuarantineQueryRepositoryPort, useExisting: QuarantineQueryRepository },
  ],
  exports: [QuarantineQueryRepositoryPort],
})
export class QuarantineInfrastructureModule {}
