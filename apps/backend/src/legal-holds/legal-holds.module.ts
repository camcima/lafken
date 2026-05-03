import { Module } from "@nestjs/common";

import { GetLegalHoldByIdUseCase } from "./application/use-cases/get-legal-hold-by-id.use-case";
import { ListLegalHoldsUseCase } from "./application/use-cases/list-legal-holds.use-case";
import { LegalHoldsInfrastructureModule } from "./infrastructure/legal-holds-infrastructure.module";
import { LegalHoldsController } from "./presentation/controllers/legal-holds.controller";

@Module({
  imports: [LegalHoldsInfrastructureModule],
  controllers: [LegalHoldsController],
  providers: [ListLegalHoldsUseCase, GetLegalHoldByIdUseCase],
})
export class LegalHoldsModule {}
