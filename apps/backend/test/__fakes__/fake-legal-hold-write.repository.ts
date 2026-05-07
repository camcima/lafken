import { LegalHold } from "@/legal-holds/domain/entities/legal-hold.entity";
import {
  type ILiftLegalHoldInput,
  type IPlaceLegalHoldInput,
  LegalHoldWriteRepositoryPort,
} from "@/legal-holds/domain/repositories/legal-hold-write.repository.port";

import { TEST_UUIDS } from "../__fixtures__/test-uuids";

export class FakeLegalHoldWriteRepository extends LegalHoldWriteRepositoryPort {
  public placeCalls: IPlaceLegalHoldInput[] = [];
  public liftCalls: ILiftLegalHoldInput[] = [];
  public placedHoldId: string = TEST_UUIDS.legalHold1;

  async placeHold(input: IPlaceLegalHoldInput): Promise<LegalHold> {
    this.placeCalls.push(input);
    const now = new Date();
    return LegalHold.fromProps({
      id: this.placedHoldId,
      caseReference: input.caseReference,
      description: input.description,
      scopeSummary: input.scopeSummary,
      placedBy: input.placedBy,
      placedAt: now,
      liftedBy: null,
      liftedAt: null,
      liftReason: null,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  async liftHold(input: ILiftLegalHoldInput): Promise<LegalHold> {
    this.liftCalls.push(input);
    const now = new Date();
    return LegalHold.fromProps({
      id: input.id,
      caseReference: "ignored-by-tests",
      description: "ignored-by-tests",
      scopeSummary: "ignored-by-tests",
      placedBy: "ignored-by-tests",
      placedAt: now,
      liftedBy: input.liftedBy,
      liftedAt: now,
      liftReason: input.liftReason,
      active: false,
      createdAt: now,
      updatedAt: now,
    });
  }
}
