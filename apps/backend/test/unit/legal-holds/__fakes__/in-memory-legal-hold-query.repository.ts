import { LegalHold } from "@/legal-holds/domain/entities/legal-hold.entity";
import {
  LegalHoldPage,
  LegalHoldQueryRepositoryPort,
  ListLegalHoldsInput,
} from "@/legal-holds/domain/repositories/legal-hold-query.repository.port";

export class InMemoryLegalHoldQueryRepository implements LegalHoldQueryRepositoryPort {
  private legalHolds: LegalHold[] = [];
  private assetCounts = new Map<string, number>();

  seed(legalHolds: LegalHold[]): void {
    this.legalHolds = legalHolds;
  }

  seedAssetCount(holdId: string, count: number): void {
    this.assetCounts.set(holdId, count);
  }

  list(input: ListLegalHoldsInput): Promise<LegalHoldPage> {
    const total = this.legalHolds.length;
    const start = (input.page - 1) * input.limit;
    return Promise.resolve({
      data: this.legalHolds.slice(start, start + input.limit),
      total,
      page: input.page,
      limit: input.limit,
      lastPage: Math.max(1, Math.ceil(total / input.limit)),
    });
  }

  findById(id: string): Promise<LegalHold | null> {
    return Promise.resolve(this.legalHolds.find((hold) => hold.props.id === id) ?? null);
  }

  countAffectedAssets(holdId: string): Promise<number> {
    return Promise.resolve(this.assetCounts.get(holdId) ?? 0);
  }
}
