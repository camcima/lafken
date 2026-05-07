import { Module } from "@nestjs/common";

import { GetLegalHoldByIdUseCase } from "./application/use-cases/get-legal-hold-by-id.use-case";
import { LiftLegalHoldUseCase } from "./application/use-cases/lift-legal-hold.use-case";
import { ListLegalHoldsUseCase } from "./application/use-cases/list-legal-holds.use-case";
import { PlaceLegalHoldUseCase } from "./application/use-cases/place-legal-hold.use-case";
import { LegalHoldsInfrastructureModule } from "./infrastructure/legal-holds-infrastructure.module";
import { LegalHoldsController } from "./presentation/controllers/legal-holds.controller";

@Module({
  imports: [LegalHoldsInfrastructureModule],
  controllers: [LegalHoldsController],
  providers: [
    ListLegalHoldsUseCase,
    GetLegalHoldByIdUseCase,
    PlaceLegalHoldUseCase,
    LiftLegalHoldUseCase,
  ],
})
export class LegalHoldsModule {}
