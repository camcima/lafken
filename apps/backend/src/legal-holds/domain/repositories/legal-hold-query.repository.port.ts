import type { LegalHold } from "../entities/legal-hold.entity";

export interface ListLegalHoldsInput {
  page: number;
  limit: number;
}

export interface LegalHoldPage {
  data: LegalHold[];
  total: number;
  page: number;
  limit: number;
  lastPage: number;
}

export abstract class LegalHoldQueryRepositoryPort {
  abstract list(input: ListLegalHoldsInput): Promise<LegalHoldPage>;
  abstract findById(id: string): Promise<LegalHold | null>;
  abstract countAffectedAssets(holdId: string): Promise<number>;
}
