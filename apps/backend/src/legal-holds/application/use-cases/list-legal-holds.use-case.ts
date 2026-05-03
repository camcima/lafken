import { Injectable } from "@nestjs/common";

import { LegalHold } from "@/legal-holds/domain/entities/legal-hold.entity";
import {
  LegalHoldQueryRepositoryPort,
  ListLegalHoldsInput,
} from "@/legal-holds/domain/repositories/legal-hold-query.repository.port";

export interface LegalHoldWithMetadata {
  legalHold: LegalHold;
  affectedAssetCount: number;
}

export interface LegalHoldWithMetadataPage {
  data: LegalHoldWithMetadata[];
  total: number;
  page: number;
  limit: number;
  lastPage: number;
}

@Injectable()
export class ListLegalHoldsUseCase {
  constructor(private readonly repository: LegalHoldQueryRepositoryPort) {}

  async execute(input: ListLegalHoldsInput): Promise<LegalHoldWithMetadataPage> {
    const page = await this.repository.list(input);

    const data = await Promise.all(
      page.data.map(async (legalHold) => {
        const affectedAssetCount = await this.repository.countAffectedAssets(legalHold.props.id);
        return { legalHold, affectedAssetCount };
      }),
    );

    return {
      data,
      total: page.total,
      page: page.page,
      limit: page.limit,
      lastPage: page.lastPage,
    };
  }
}
