import { LegalHold } from "@/legal-holds/domain/entities/legal-hold.entity";
import {
  type LegalHoldPage,
  LegalHoldQueryRepositoryPort,
  type ListLegalHoldsInput,
} from "@/legal-holds/domain/repositories/legal-hold-query.repository.port";

export class FakeLegalHoldQueryRepository extends LegalHoldQueryRepositoryPort {
  public holds = new Map<string, LegalHold>();
  public coveredAssetIdsByHold = new Map<string, string[]>();

  list(input: ListLegalHoldsInput): Promise<LegalHoldPage> {
    const data = [...this.holds.values()];
    return Promise.resolve({
      data,
      total: data.length,
      page: input.page,
      limit: input.limit,
      lastPage: 1,
    });
  }

  findById(id: string): Promise<LegalHold | null> {
    return Promise.resolve(this.holds.get(id) ?? null);
  }

  countAffectedAssets(holdId: string): Promise<number> {
    return Promise.resolve(this.coveredAssetIdsByHold.get(holdId)?.length ?? 0);
  }

  listAssetInternalIds(holdId: string): Promise<string[]> {
    return Promise.resolve(this.coveredAssetIdsByHold.get(holdId) ?? []);
  }
}
